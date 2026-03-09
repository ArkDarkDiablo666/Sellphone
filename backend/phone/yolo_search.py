"""
yolo_search.py — Tìm kiếm bằng ảnh dùng YOLOv8 Classification
Tối ưu: Incremental learning
  - Cập nhật biến thể (ảnh mới) → chỉ fine-tune class đó, epochs ít
  - Thêm sản phẩm mới           → thêm class mới, train lại toàn bộ (bắt buộc)
  - Class mapping lưu theo ProductID, không bao giờ đổi

Cài đặt:
    pip install ultralytics pillow

Cấu trúc thư mục:
    media/yolo/
    ├── dataset/
    │   ├── train/
    │   │   ├── product_1/
    │   │   └── product_2/
    │   └── val/
    │       └── product_1/
    └── models/
        ├── phonezone_clf.pt   ← model hiện tại
        └── class_meta.json    ← {class_name: product_id, ...}
        └── product_img_hash.json ← {product_id: [url, ...]} để detect thay đổi
"""

import io
import json
import logging
import shutil
import threading
import urllib.request
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Đường dẫn ───────────────────────────────────────────────────────────────
BASE_DIR      = Path(__file__).resolve().parent.parent
YOLO_DIR      = BASE_DIR / "media" / "yolo"
DATASET_DIR   = YOLO_DIR / "dataset"
TRAIN_DIR     = DATASET_DIR / "train"
VAL_DIR       = DATASET_DIR / "val"
MODEL_DIR     = YOLO_DIR / "models"
MODEL_PATH    = MODEL_DIR / "phonezone_clf.pt"
META_PATH     = MODEL_DIR / "class_meta.json"
IMG_HASH_PATH = MODEL_DIR / "product_img_hash.json"

for d in (TRAIN_DIR, VAL_DIR, MODEL_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ─── Lock toàn cục để không train đồng thời ─────────────────────────────────
_train_lock = threading.Lock()


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _class_name(product_id) -> str:
    return f"product_{product_id}"


def _class_dir(product_id, split: str) -> Path:
    root = TRAIN_DIR if split == "train" else VAL_DIR
    d = root / _class_name(product_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _download(url: str, dest: Path) -> bool:
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
        if len(data) < 1000:
            return False
        dest.write_bytes(data)
        return True
    except Exception as e:
        logger.debug(f"[YOLO] Download failed {url}: {e}")
        return False


def _collect_urls(product_id) -> list:
    """Thu thập tất cả URL ảnh của sản phẩm (ProductImage + Variant.Image)."""
    from .models import Product, ProductVariant, ProductImage
    urls = []
    product = Product.objects.filter(ProductID=product_id).first()
    if not product:
        return urls
    for img in ProductImage.objects.filter(ProductID=product).order_by("-IsPrimary"):
        if img.ImageUrl and img.ImageUrl not in urls:
            urls.append(img.ImageUrl)
    for v in ProductVariant.objects.filter(ProductID=product):
        if v.Image and v.Image not in urls:
            urls.append(v.Image)
    return urls


def _prepare_images(product_id, urls: list) -> int:
    """Tải ảnh vào train/ và val/ cho product_id. Xóa ảnh cũ trước."""
    for split in ("train", "val"):
        d = _class_dir(product_id, split)
        for f in d.iterdir():
            try:
                f.unlink()
            except Exception:
                pass

    count = 0
    for i, url in enumerate(urls):
        ext = Path(url.split("?")[0]).suffix.lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp"):
            ext = ".jpg"
        split = "val" if i % 5 == 4 else "train"
        dest  = _class_dir(product_id, split) / f"{i:04d}{ext}"
        if _download(url, dest):
            count += 1
    return count


def _load_meta() -> dict:
    """Load class_meta: {class_name → product_id}"""
    if META_PATH.exists():
        try:
            return json.loads(META_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_meta(meta: dict):
    META_PATH.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")


def _load_img_hash() -> dict:
    """Load product_img_hash: {product_id → [url, ...]}"""
    if IMG_HASH_PATH.exists():
        try:
            return json.loads(IMG_HASH_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_img_hash(data: dict):
    IMG_HASH_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _count_valid_classes(split: str = "train") -> int:
    root = TRAIN_DIR if split == "train" else VAL_DIR
    if not root.exists():
        return 0
    return sum(1 for d in root.iterdir() if d.is_dir() and any(d.iterdir()))


def _ensure_val_not_empty():
    """Đảm bảo val/ có ít nhất 1 ảnh mỗi class."""
    for td in TRAIN_DIR.iterdir():
        if not td.is_dir():
            continue
        vd = VAL_DIR / td.name
        vd.mkdir(exist_ok=True)
        if not any(vd.iterdir()):
            imgs = list(td.iterdir())
            if imgs:
                shutil.copy(imgs[0], vd / imgs[0].name)


def _is_new_product(product_id) -> bool:
    """Kiểm tra product_id có phải class mới chưa có trong dataset không."""
    meta = _load_meta()
    return _class_name(product_id) not in meta


def _urls_changed(product_id, new_urls: list) -> bool:
    """Kiểm tra danh sách ảnh có thay đổi so với lần train trước không."""
    img_hash = _load_img_hash()
    old_urls = img_hash.get(str(product_id), [])
    return set(old_urls) != set(new_urls)


def _update_img_hash(product_id, urls: list):
    img_hash = _load_img_hash()
    img_hash[str(product_id)] = urls
    _save_img_hash(img_hash)


# ═══════════════════════════════════════════════════════════════════════════════
# CORE TRAIN
# ═══════════════════════════════════════════════════════════════════════════════

def _run_train(epochs: int, imgsz: int = 224) -> bool:
    """
    Chạy model.train() với toàn bộ DATASET_DIR.
    Luôn được gọi bên trong _train_lock.
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        logger.error("[YOLO] Chưa cài ultralytics. Chạy: pip install ultralytics")
        return False

    _ensure_val_not_empty()

    if MODEL_PATH.exists():
        model = YOLO(str(MODEL_PATH))
    else:
        model = YOLO("yolov8n-cls.pt")

    try:
        model.train(
            data=str(DATASET_DIR),
            task="classify",
            epochs=epochs,
            imgsz=imgsz,
            batch=8,
            patience=5,
            save=True,
            project=str(MODEL_DIR),
            name="run",
            exist_ok=True,
            verbose=False,
            workers=0,
        )
    except Exception as e:
        logger.error(f"[YOLO] Training lỗi: {e}")
        return False

    # Lưu best/last weights
    best = MODEL_DIR / "run" / "weights" / "best.pt"
    last = MODEL_DIR / "run" / "weights" / "last.pt"
    src  = best if best.exists() else (last if last.exists() else None)
    if src:
        shutil.copy(src, MODEL_PATH)

    # Cập nhật class_meta
    classes = sorted(d.name for d in TRAIN_DIR.iterdir() if d.is_dir() and any(d.iterdir()))
    meta    = {cls: cls.replace("product_", "") for cls in classes}
    _save_meta(meta)

    logger.info(f"[YOLO] Train xong. Total classes={len(classes)}, epochs={epochs}")
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════════

def train_product(product_id, force: bool = False) -> bool:
    """
    Smart train theo 3 trường hợp:

    1. Sản phẩm MỚI (class chưa tồn tại):
       → Tải ảnh + train toàn bộ dataset (epochs=30)
       → Bắt buộc train lại toàn bộ vì số class thay đổi

    2. Cập nhật biến thể / ảnh THAY ĐỔI (class cũ, ảnh mới):
       → Tải ảnh mới + fine-tune nhẹ (epochs=10)
       → Chỉ update weights, không thêm class mới

    3. Không có gì thay đổi:
       → Bỏ qua, không train

    Args:
        product_id: ID sản phẩm
        force: Bỏ qua kiểm tra thay đổi, luôn train lại
    """
    urls = _collect_urls(product_id)
    if not urls:
        logger.warning(f"[YOLO] Sản phẩm {product_id} không có ảnh, bỏ qua")
        return False

    is_new    = _is_new_product(product_id)
    changed   = _urls_changed(product_id, urls)

    if not force and not is_new and not changed:
        logger.info(f"[YOLO] Sản phẩm {product_id}: không có thay đổi, bỏ qua train")
        return True

    # Tải ảnh mới cho sản phẩm này
    n = _prepare_images(product_id, urls)
    if n < 1:
        logger.warning(f"[YOLO] Sản phẩm {product_id}: không tải được ảnh nào")
        return False

    _update_img_hash(product_id, urls)

    n_classes = _count_valid_classes("train")
    if n_classes < 2:
        logger.info(f"[YOLO] Mới có {n_classes} class — cần ≥2 sản phẩm để train")
        return False

    with _train_lock:
        if is_new:
            # Sản phẩm mới: train đầy đủ vì số class tăng
            logger.info(f"[YOLO] Sản phẩm MỚI {product_id} → train toàn bộ (epochs=30)")
            return _run_train(epochs=30)
        else:
            # Cập nhật ảnh: fine-tune nhẹ
            logger.info(f"[YOLO] Cập nhật ảnh {product_id} → fine-tune (epochs=10)")
            return _run_train(epochs=10)


def train_product_async(product_id, force: bool = False):
    """Chạy train_product() trong background thread."""
    t = threading.Thread(
        target=train_product,
        args=(product_id,),
        kwargs={"force": force},
        daemon=True,
        name=f"yolo-train-{product_id}",
    )
    t.start()
    return t


def retrain_all(epochs: int = 30) -> bool:
    """
    Train lại toàn bộ từ đầu với tất cả sản phẩm hiện có.
    Dùng khi cần rebuild hoàn toàn (VD: sau khi xóa nhiều sản phẩm).
    """
    from .models import Product
    products = list(Product.objects.all().values_list("ProductID", flat=True))
    logger.info(f"[YOLO] retrain_all: {len(products)} sản phẩm")

    for pid in products:
        urls = _collect_urls(pid)
        if urls:
            _prepare_images(pid, urls)
            _update_img_hash(pid, urls)

    n_classes = _count_valid_classes("train")
    if n_classes < 2:
        logger.warning(f"[YOLO] retrain_all: chỉ có {n_classes} class hợp lệ")
        return False

    with _train_lock:
        # Reset model để train from scratch
        if MODEL_PATH.exists():
            MODEL_PATH.unlink()
        return _run_train(epochs=epochs)


# ═══════════════════════════════════════════════════════════════════════════════
# INFERENCE
# ═══════════════════════════════════════════════════════════════════════════════

def search_by_image(image_bytes: bytes, top_k: int = 10) -> list:
    """
    Nhận bytes ảnh, trả về list[product_id] sắp xếp theo confidence.
    """
    if not MODEL_PATH.exists():
        logger.warning("[YOLO] Model chưa được train")
        return []

    try:
        from ultralytics import YOLO
        from PIL import Image
    except ImportError:
        logger.error("[YOLO] Thiếu ultralytics / pillow")
        return []

    meta = _load_meta()
    if not meta:
        return []

    try:
        model  = YOLO(str(MODEL_PATH))
        img    = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        result = model.predict(img, verbose=False)[0]

        class_names = model.names
        probs       = result.probs.data.tolist()

        top_k  = min(top_k, len(probs))
        ranked = sorted(range(len(probs)), key=lambda i: probs[i], reverse=True)[:top_k]

        product_ids = []
        for cls_idx in ranked:
            cls_name = class_names.get(cls_idx, "")
            pid      = meta.get(cls_name) or cls_name.replace("product_", "")
            if pid and probs[cls_idx] >= 0.5:
                product_ids.append(pid)

        return product_ids

    except Exception as e:
        logger.error(f"[YOLO] Inference lỗi: {e}")
        return []


def get_model_info() -> dict:
    meta = _load_meta()
    img_hash = _load_img_hash()
    return {
        "model_exists":    MODEL_PATH.exists(),
        "num_classes":     len(meta),
        "classes":         list(meta.values()),
        "model_size_mb":   round(MODEL_PATH.stat().st_size / 1e6, 1) if MODEL_PATH.exists() else 0,
        "tracked_products": len(img_hash),
    }