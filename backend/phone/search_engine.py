"""
search_engine.py — Bộ máy tìm kiếm text cho PHONEZONE
Thuật toán: BM25 + Trigram fuzzy matching + Model number exact matching
"""

import math
import re
from collections import defaultdict
from typing import Optional


# ═══════════════════════════════════════════════════════════════════════════════
# TEXT UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())


def tokenize(text: str) -> list:
    """
    Tách token thông minh hơn: giữ nguyên các chuỗi model như '16e', '14 pro max', v.v.
    """
    tokens = re.findall(r"[^\s\W]+", normalize(text), re.UNICODE)
    return tokens


def trigrams(text: str) -> set:
    t = normalize(text)
    if not t:
        return set()
    padded = f"  {t}  "
    return {padded[i:i+3] for i in range(len(padded) - 2)}


def trigram_similarity(a: str, b: str) -> float:
    ta, tb = trigrams(a), trigrams(b)
    if not ta or not tb:
        return 0.0
    return 2.0 * len(ta & tb) / (len(ta) + len(tb))


def prefix_similarity(query: str, term: str) -> float:
    q, t = normalize(query), normalize(term)
    if t.startswith(q):
        return 0.8
    if q in t:
        return 0.5
    return 0.0


def extract_model_tokens(text: str) -> list:
    """
    Trích xuất các token đặc trưng của model: số + chữ liền nhau như '16e', '14', '15pro', v.v.
    VD: 'iPhone 16e Pro Max' → ['16e', 'pro', 'max', '16']
    """
    t = normalize(text)
    # Model token: số kèm chữ (16e, 15pro) hoặc số đơn (14, 16)
    model_tokens = re.findall(r'\d+[a-z]*', t)
    return model_tokens


def model_tokens_match(query: str, title: str) -> float:
    """
    Kiểm tra xem tất cả model token trong query có xuất hiện trong title không.
    Nếu query có '16e', title phải có '16e' chứ không phải '16' hay '14'.
    Trả về score bonus.
    """
    q_model = extract_model_tokens(query)
    t_model = extract_model_tokens(title)
    t_norm  = normalize(title)

    if not q_model:
        return 0.0

    score = 0.0
    all_match = True

    for qm in q_model:
        # Exact match trong model tokens của title
        if qm in t_model:
            score += 3.0
        # Partial: query token xuất hiện như substring trong title
        elif qm in t_norm:
            score += 1.0
        else:
            all_match = False
            score -= 2.0  # Phạt nặng nếu model token không match

    # Bonus nếu tất cả đều match chính xác
    if all_match and q_model:
        score += 2.0

    return score


def has_conflicting_model(query: str, title: str) -> bool:
    """
    Kiểm tra xem title có chứa model number KHÁC với query không.
    VD: query='16e', title='iPhone 14' → True (conflict)
         query='16e', title='iPhone 16e' → False (no conflict)
    """
    q_model = extract_model_tokens(query)
    t_model = extract_model_tokens(title)

    if not q_model or not t_model:
        return False

    # Lấy số thuần từ query (bỏ chữ suffix)
    q_numbers = set(re.findall(r'\d+', ' '.join(q_model)))
    t_numbers = set(re.findall(r'\d+', ' '.join(t_model)))

    for qn in q_numbers:
        for tn in t_numbers:
            # Nếu title có số mà query không có → conflict
            if tn != qn and qn not in tn and tn not in qn:
                # Nhưng chỉ conflict nếu chúng là cùng dòng sản phẩm (cùng brand keyword)
                q_norm = normalize(query)
                t_norm = normalize(title)
                # Lấy brand từ query (từ đầu tiên không phải số)
                q_words = [w for w in q_norm.split() if not re.match(r'^\d', w)]
                if q_words:
                    brand_word = q_words[0]
                    if brand_word in t_norm:
                        return True
    return False


# ═══════════════════════════════════════════════════════════════════════════════
# BM25 INDEX
# ═══════════════════════════════════════════════════════════════════════════════

class BM25Index:
    K1: float = 1.5
    B:  float = 0.75
    FUZZY_THRESHOLD: float = 0.55

    def __init__(self):
        self.docs: list        = []
        self.inverted: dict    = defaultdict(list)
        self.doc_lengths: list = []
        self.avg_dl: float     = 0.0
        self.N: int            = 0
        self._vocab: Optional[list] = None

    def build(self, products):
        self.docs        = []
        self.inverted    = defaultdict(list)
        self.doc_lengths = []
        self._vocab      = None

        for p in products:
            title = p.ProductName or ""
            brand = p.Brand or ""
            try:
                cat = p.CategoryID.CategoryName if p.CategoryID else ""
            except Exception:
                cat = ""
            desc = (p.Description or "")[:500]

            variant_text = ""
            try:
                for v in p.productvariant_set.all():
                    for field in ["Color", "Ram", "Storage", "Cpu",
                                  "OperatingSystem", "ScreenSize", "ScreenTechnology"]:
                        val = getattr(v, field, None)
                        if val:
                            variant_text += f" {val}"
            except Exception:
                pass

            # Title nhân 4 để tăng trọng số, thêm model tokens riêng
            model_tokens_str = " ".join(extract_model_tokens(title))
            body   = (
                f"{title} {title} {title} {title} "
                f"{model_tokens_str} {model_tokens_str} "
                f"{brand} {brand} {cat} {desc} {variant_text}"
            )
            tokens = tokenize(body)
            freq: dict = defaultdict(int)
            for t in tokens:
                freq[t] += 1

            doc_idx = len(self.docs)
            self.docs.append({"id": p.ProductID, "title": title, "brand": brand, "product": p})
            self.doc_lengths.append(len(tokens))
            for term, tf in freq.items():
                self.inverted[term].append((doc_idx, tf))

        self.N      = len(self.docs)
        self.avg_dl = sum(self.doc_lengths) / max(self.N, 1)

    def _idf(self, term: str) -> float:
        df = len(self.inverted.get(term, []))
        return math.log((self.N - df + 0.5) / (df + 0.5) + 1.0)

    def _tf_norm(self, tf: int, doc_idx: int) -> float:
        dl   = self.doc_lengths[doc_idx]
        norm = self.K1 * (1.0 - self.B + self.B * dl / self.avg_dl)
        return tf * (self.K1 + 1.0) / (tf + norm)

    def score(self, query: str, top_k: int = 50) -> list:
        q_tokens = tokenize(query)
        if not q_tokens or not self.docs:
            return []

        scores: dict = defaultdict(float)
        q_model_tokens = extract_model_tokens(query)
        has_model_query = len(q_model_tokens) > 0

        for term in q_tokens:
            postings = self.inverted.get(term, [])
            if postings:
                idf = self._idf(term)
                for doc_idx, tf in postings:
                    scores[doc_idx] += idf * self._tf_norm(tf, doc_idx)
            else:
                # Fuzzy — CHỈ dùng cho non-model tokens
                # Không fuzzy match model numbers để tránh '16e' → '16' → '14'
                is_model_token = bool(re.match(r'^\d+[a-z]*$', term))
                if not is_model_token:
                    if self._vocab is None:
                        self._vocab = list(self.inverted.keys())
                    for vt in self._vocab:
                        if abs(len(vt) - len(term)) > max(len(term), 3):
                            continue
                        sim = max(trigram_similarity(term, vt), prefix_similarity(term, vt))
                        if sim >= self.FUZZY_THRESHOLD:
                            idf = self._idf(vt)
                            for doc_idx, tf in self.inverted[vt]:
                                scores[doc_idx] += sim * idf * self._tf_norm(tf, doc_idx)

        # ── Bonus / Penalty dựa trên title matching ──
        q_norm = normalize(query)
        for doc_idx, doc in enumerate(self.docs):
            title_n = normalize(doc["title"])
            brand_n = normalize(doc["brand"])

            # 1. Model number matching (quan trọng nhất)
            if has_model_query:
                model_score = model_tokens_match(query, doc["title"])
                scores[doc_idx] += model_score

                # Phạt mạnh nếu title chứa model number khác
                # VD: tìm '16e' mà title là 'iPhone 14' → trừ điểm
                doc_model = extract_model_tokens(doc["title"])
                if doc_model:
                    # Kiểm tra xem tất cả q_model_token có trong doc_model không
                    missing = [qm for qm in q_model_tokens if qm not in doc_model]
                    if missing:
                        # Có model token không khớp → phạt nặng
                        scores[doc_idx] -= 8.0 * len(missing)
                    else:
                        # Tất cả model token đều khớp → bonus lớn
                        scores[doc_idx] += 10.0

            # 2. Full query substring match trong title
            if q_norm in title_n:
                scores[doc_idx] += 8.0
            elif q_norm in brand_n or brand_n in q_norm:
                scores[doc_idx] += 2.0
            else:
                # Token-level match
                for tok in q_tokens:
                    if tok in title_n:
                        scores[doc_idx] += 0.8

        # Lọc kết quả âm (không liên quan)
        result = [(sc, self.docs[idx]) for idx, sc in scores.items() if sc > 0]
        result.sort(key=lambda x: x[0], reverse=True)
        return result[:top_k]


# ═══════════════════════════════════════════════════════════════════════════════
# SINGLETON
# ═══════════════════════════════════════════════════════════════════════════════

_index: Optional[BM25Index] = None
_version: int = 0


def get_index() -> BM25Index:
    global _index
    if _index is None:
        rebuild_index()
    return _index


def rebuild_index() -> int:
    global _index, _version
    from .models import Product
    _index = BM25Index()
    qs = Product.objects.select_related("CategoryID").prefetch_related("productvariant_set").all()
    _index.build(qs)
    _version += 1
    return _version


def get_version() -> int:
    return _version