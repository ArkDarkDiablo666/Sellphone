import { useState, useEffect, useRef } from "react";
import Blockeditor from "./Blockeditor";
import { useNavigate } from "react-router-dom";
import {
  User, LogOut, Camera, Settings, Package,
  PackagePlus, Users, ChevronRight, Eye, EyeOff,
  Pencil, Check, X, Plus, Shield, AlertTriangle, LayoutGrid, Ticket,
  AlignLeft, AlignCenter, AlignRight, Image as ImageIcon,
  ShoppingBag, Clock, RefreshCw, Truck, CheckCircle2, XCircle, ChevronDown,
  RotateCcw, FileVideo, AlertCircle, FileText, Newspaper, Trash2 
} from "lucide-react";

const API = "http://localhost:8000";


// ============================================================
// RICH TEXT EDITOR - cho mô tả sản phẩm
// ============================================================
function RichEditor({ value, onChange }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, []); // eslint-disable-line

  const exec = (cmd, val = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    syncContent();
  };

  const syncContent = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const insertImage = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        exec("insertImage", reader.result);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const setFontSize = (size) => exec("fontSize", size);
  const setColor    = (color) => exec("foreColor", color);

  const COLORS = ["#ffffff","#ff9500","#ff3b30","#30d158","#0a84ff","#bf5af2","#ffd60a","#636366","#000000"];
  const SIZES  = [{ label:"S", val:"2" },{ label:"N", val:"3" },{ label:"L", val:"4" },{ label:"XL", val:"5" },{ label:"2XL", val:"6" }];

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 bg-white/3 border-b border-white/10">
        {/* Bold / Italic / Underline */}
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}
          className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition text-xs font-bold">B</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("italic"); }}
          className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition text-xs italic">I</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("underline"); }}
          className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition text-xs underline">U</button>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Căn lề */}
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("justifyLeft"); }}
          title="Trái" className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition">
          <AlignLeft size={13} />
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("justifyCenter"); }}
          title="Giữa" className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition">
          <AlignCenter size={13} />
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("justifyRight"); }}
          title="Phải" className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition">
          <AlignRight size={13} />
        </button>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Kích thước chữ */}
        <div className="flex items-center gap-0.5">
          {SIZES.map((s) => (
            <button key={s.val} type="button" onMouseDown={(e) => { e.preventDefault(); setFontSize(s.val); }}
              className="px-2 h-7 rounded-lg hover:bg-white/10 text-xs transition text-white/60 hover:text-white">
              {s.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Màu chữ */}
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button key={c} type="button" onMouseDown={(e) => { e.preventDefault(); setColor(c); }}
              title={c}
              style={{ backgroundColor: c }}
              className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition" />
          ))}
          {/* Custom color */}
          <label className="w-5 h-5 rounded-full border border-dashed border-white/30 hover:border-white/60 flex items-center justify-center cursor-pointer transition" title="Màu tùy chỉnh">
            <span className="text-[8px] text-white/40">+</span>
            <input type="color" className="opacity-0 absolute w-0 h-0"
              onChange={(e) => { setColor(e.target.value); }} />
          </label>
        </div>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Chèn ảnh */}
        <button type="button" onMouseDown={(e) => { e.preventDefault(); insertImage(); }}
          title="Chèn ảnh" className="w-7 h-7 rounded-lg hover:bg-orange-500/20 text-orange-400 flex items-center justify-center transition">
          <ImageIcon size={13} />
        </button>

        {/* Danh sách */}
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }}
          className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition text-xs">•≡</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }}
          className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition text-xs">1≡</button>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Xóa định dạng */}
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("removeFormat"); }}
          title="Xóa định dạng" className="w-7 h-7 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 flex items-center justify-center transition text-xs">T̶</button>
      </div>

      {/* Content editable */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={syncContent}
        onBlur={syncContent}
        className="min-h-[140px] max-h-[320px] overflow-y-auto p-4 text-sm text-white/70 outline-none leading-relaxed"
        style={{ caretColor: "white" }}
        data-placeholder="Nhập mô tả sản phẩm... (hỗ trợ định dạng chữ, màu sắc, kích thước, chèn ảnh)"
      />

      <style>{`
        [contenteditable]:empty:before { content: attr(data-placeholder); color: rgba(255,255,255,0.2); pointer-events: none; }
        [contenteditable] img { max-width: 100%; border-radius: 8px; margin: 4px 0; }
      `}</style>
    </div>
  );
}

export default function Admin() {
  const navigate  = useNavigate();
  const adminLocal = JSON.parse(localStorage.getItem("admin_user") || "{}");

  const [activeTab, setActiveTab]         = useState("profile");
  const [admin, setAdmin]                 = useState(null);
  const [loading, setLoading]             = useState(true);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [saving, setSaving]               = useState(false);
  const [errors, setErrors]               = useState({});

  // Profile edit
  const [editPass, setEditPass] = useState(false);
  const [passForm, setPassForm] = useState({ current: "", newPass: "", confirm: "" });
  const [showPass, setShowPass] = useState({ current: false, newPass: false, confirm: false });

  // Staff management
  const [staffList, setStaffList]         = useState([]);
  const [staffLoading, setStaffLoading]   = useState(false);
  const [showAddStaff, setShowAddStaff]   = useState(false);
  const [newStaff, setNewStaff]           = useState({ fullname: "", email: "", password: "", role: "Staff" });
  const [newStaffErrors, setNewStaffErrors] = useState({});

  // Category
  const [catList, setCatList]               = useState([]);
  const [catLoading, setCatLoading]         = useState(false);
  const [showAddCat, setShowAddCat]         = useState(false);
  const [catSaving, setCatSaving]           = useState(false);
  const [editCatId, setEditCatId]           = useState(null);
  const [editCatName, setEditCatName]       = useState("");
  const [editCatImage, setEditCatImage]     = useState(null);
  const [editCatPreview, setEditCatPreview] = useState("");
  const [newCatName, setNewCatName]         = useState("");
  const [newCatImage, setNewCatImage]       = useState(null);
  const [newCatPreview, setNewCatPreview]   = useState("");
  const catImageRef    = useRef(null);
  const editCatImgRef  = useRef(null);

  // Product
  const [categories, setCategories]         = useState([]);
  const [productList, setProductList]       = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productSaving, setProductSaving]   = useState(false);
  const [productErrors, setProductErrors]   = useState({});
  const [newProduct, setNewProduct] = useState({
    name: "", brand: "", description: "", categoryId: "",
  });
  const EMPTY_VARIANT = {
    color: "", storage: "", ram: "", price: "", stock: "",
    cpu: "", os: "", screenSize: "", screenTech: "", refreshRate: "",
    battery: "", chargingSpeed: "", frontCamera: "", rearCamera: "",
    weights: "", updates: "", imageFile: null, imagePreview: "",
  };
  const [variants, setVariants] = useState([{ ...EMPTY_VARIANT }]);
  const [productImages, setProductImages] = useState([]);
  const productImageRef = useRef(null);

  // Thêm biến thể vào sản phẩm có sẵn
  const [addVarProductId,   setAddVarProductId]   = useState(null); // ID sản phẩm đang mở panel
  const [addVarProductName, setAddVarProductName] = useState("");
  const [addVarList,        setAddVarList]        = useState([{ ...{color:"",storage:"",ram:"",price:"",stock:"",cpu:"",os:"",screenSize:"",screenTech:"",refreshRate:"",battery:"",chargingSpeed:"",frontCamera:"",rearCamera:"",weights:"",updates:"",imageFile:null,imagePreview:""} }]);
  const [addVarErrors,      setAddVarErrors]      = useState({});
  const [addVarSaving,      setAddVarSaving]      = useState(false);
  const [existingVariants,  setExistingVariants]  = useState([]);

  // Voucher management
  const [voucherList,    setVoucherList]    = useState([]);

  // Order management
  const [orderList,    setOrderList]    = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderDetail,  setOrderDetail]  = useState(null);
  const [updatingOrder,setUpdatingOrder]= useState(null);
  const [statusNote,   setStatusNote]   = useState("");

  // Post (bài viết)
  const [postList,      setPostList]      = useState([]);
  const [postLoading,   setPostLoading]   = useState(false);
  const [showPostForm,  setShowPostForm]  = useState(false);
  const [editingPost,   setEditingPost]   = useState(null);
  const [postForm,      setPostForm]      = useState({ title: "", category: "Mẹo vặt", blocks: [], mediaFiles: {} });
  const [postSaving,    setPostSaving]    = useState(false);

  // Product content (mô tả rich)
  const [pcProductId,   setPcProductId]   = useState("");
  const [pcBlocks,      setPcBlocks]      = useState([]);
  const [pcMediaFiles,  setPcMediaFiles]  = useState({});
  const [pcSaving,      setPcSaving]      = useState(false);
  const [pcLoaded,      setPcLoaded]      = useState(false);

  // Return management
  const [returnList,    setReturnList]    = useState([]);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnDetail,  setReturnDetail]  = useState(null);
  const [returnNote,    setReturnNote]    = useState("");
  const [processingReturn, setProcessingReturn] = useState(false);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [showAddVoucher, setShowAddVoucher] = useState(false);
  const [voucherSaving,  setVoucherSaving]  = useState(false);
  const [newVoucher, setNewVoucher] = useState({
    code: "", type: "percent", value: "", scope: "all",
    category_id: "", product_id: "", min_order: "", max_discount: "",
    start_date: "", end_date: "", usage_limit: "",
  });

  // Import
  const [importProductId, setImportProductId]     = useState("");
  const [importVariants, setImportVariants]        = useState([]);
  const [importQty, setImportQty]                  = useState({});
  const [importLoading, setImportLoading]           = useState(false);
  const [importSaving, setImportSaving]             = useState(false);

  const fileInputRef = useRef(null);

  // ===== LOAD ADMIN INFO =====
  useEffect(() => {
    if (!adminLocal.id || adminLocal.loginType !== "admin") { navigate("/admin/login"); return; }
    fetch(`${API}/api/staff/${adminLocal.id}/`)
      .then((r) => r.json())
      .then((data) => setAdmin(data))
      .catch(() => setAdmin({
        id: adminLocal.id, full_name: adminLocal.fullName,
        email: adminLocal.username, avatar: adminLocal.avatar, role: adminLocal.role,
      }))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== LOAD STAFF LIST =====
  const loadStaff = async () => {
    setStaffLoading(true);
    try {
      const res  = await fetch(`${API}/api/staff/list/`);
      const data = await res.json();
      if (res.ok) setStaffList(data.staff || []);
    } finally { setStaffLoading(false); }
  };

  useEffect(() => { if (activeTab === "staff")   loadStaff();    }, [activeTab]); // eslint-disable-line
  useEffect(() => { if (activeTab === "product")  loadProducts(); }, [activeTab]); // eslint-disable-line
  useEffect(() => { if (activeTab === "category") loadCategories(); }, [activeTab]); // eslint-disable-line
  useEffect(() => { if (activeTab === "import")  loadProducts();  }, [activeTab]); // eslint-disable-line
  useEffect(() => { if (activeTab === "voucher") loadVouchers();  }, [activeTab]); // eslint-disable-line
  useEffect(() => { if (activeTab === "orders")  loadOrders();    }, [activeTab]); // eslint-disable-line
  useEffect(() => { if (activeTab === "returns") loadReturns();   }, [activeTab]); // eslint-disable-line
  useEffect(() => { if (activeTab === "posts")   loadPosts();     }, [activeTab]); // eslint-disable-line
  useEffect(() => { if (activeTab === "product") loadProducts();  }, [activeTab]); // eslint-disable-line
  useEffect(() => { if (activeTab === "product_content") loadProducts(); }, [activeTab]);

  const loadProducts = async () => {
    setProductLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch(`${API}/api/product/categories/`),
        fetch(`${API}/api/product/list/`),
      ]);
      const catData  = await catRes.json();
      const prodData = await prodRes.json();
      if (catRes.ok)  setCategories(catData.categories || []);
      if (prodRes.ok) setProductList(prodData.products  || []);
    } finally { setProductLoading(false); }
  };

  const addVariant    = () => setVariants((v) => [...v, { color: "", storage: "", ram: "", price: "", stock: "", cpu: "", os: "", screenSize: "", screenTech: "", refreshRate: "", battery: "", chargingSpeed: "", frontCamera: "", rearCamera: "", weights: "", updates: "", imageFile: null, imagePreview: "" }]);
  const removeVariant = (i) => setVariants((v) => v.filter((_, idx) => idx !== i));
  const updateVariant = (i, key, val) => setVariants((v) => v.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  // Validate RAM: số > 4, đơn vị GB
  const validateRam = (val) => {
    if (!val) return "Vui lòng nhập RAM";
    const match = val.trim().match(/^(\d+(?:\.\d+)?)\s*GB$/i);
    if (!match) return "RAM phải có dạng số + GB (VD: 8GB)";
    const num = parseFloat(match[1]);
    if (num < 4) return "RAM tối thiểu là 4GB";
    return null;
  };

  // Validate storage: số >= 64 nếu GB, >= 1 nếu TB
  const validateStorage = (val) => {
    if (!val) return null;
    const match = val.trim().match(/^(\d+(?:\.\d+)?)\s*(GB|TB)$/i);
    if (!match) return "Bộ nhớ phải có dạng số + GB/TB (VD: 128GB, 1TB)";
    const num  = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    if (unit === "GB" && num < 64) return "Bộ nhớ GB phải từ 64GB trở lên";
    if (unit === "TB" && num < 1)  return "Bộ nhớ TB phải từ 1TB trở lên";
    return null;
  };

  const handleSaveProduct = async () => {
    const errs = {};
    if (!newProduct.name.trim()) errs.name       = "Vui lòng nhập tên sản phẩm";
    if (!newProduct.categoryId)  errs.categoryId = "Vui lòng chọn danh mục";
    if (variants.length === 0)   errs.variants   = "Sản phẩm cần ít nhất 1 biến thể";

    // Validate từng biến thể
    const variantErrs = variants.map((v, i) => {
      const ve = {};
      if (!v.price)                       ve.price   = "Vui lòng nhập giá";
      else if (isNaN(v.price) || parseFloat(v.price) <= 0) ve.price = "Giá phải lớn hơn 0";

      if (!v.stock)                       ve.stock   = "Vui lòng nhập số lượng";
      else if (isNaN(v.stock) || parseInt(v.stock) <= 0)   ve.stock = "Số lượng phải lớn hơn 0";
      else if (parseInt(v.stock) > 10000) ve.stock   = "Số lượng tối đa 10.000";

      if (!v.ram) {
        ve.ram = "Vui lòng nhập RAM";
      } else {
        const ramErr = validateRam(v.ram);
        if (ramErr) ve.ram = ramErr;
      }

      if (!v.storage) {
        ve.storage = "Vui lòng nhập bộ nhớ trong";
      } else {
        const storageErr = validateStorage(v.storage);
        if (storageErr) ve.storage = storageErr;
      }
      return ve;
    });

    const hasVariantErr = variantErrs.some((ve) => Object.keys(ve).length > 0);
    if (hasVariantErr) errs.variantDetails = variantErrs;

    setProductErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setProductSaving(true);
    try {
      const formData = new FormData();
      formData.append("product_name",  newProduct.name);
      formData.append("brand",         newProduct.brand);
      formData.append("description",   newProduct.description);
      formData.append("category_id",   newProduct.categoryId);
      // Lọc bỏ imageFile/imagePreview trước khi gửi variants JSON
      const variantsClean = variants.map(({ imageFile, imagePreview, ...rest }) => rest);
      formData.append("variants", JSON.stringify(variantsClean));
      productImages.forEach((f) => formData.append("images", f));
      // Ảnh từng biến thể
      variants.forEach((v, i) => {
        if (v.imageFile) formData.append(`variant_image_${i}`, v.imageFile);
      });
      const res  = await fetch(`${API}/api/product/create/`, { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setShowAddProduct(false);
        setNewProduct({ name: "", brand: "", description: "", categoryId: "" });
        setVariants([{ color: "", storage: "", ram: "", price: "", stock: "", cpu: "", os: "", screenSize: "", screenTech: "", refreshRate: "", battery: "", chargingSpeed: "", frontCamera: "", rearCamera: "", weights: "", updates: "", imageFile: null, imagePreview: "" }]);
        setProductImages([]);
        loadProducts();
        alert("Tạo sản phẩm thành công!");
      } else { setProductErrors({ general: data.message }); }
    } finally { setProductSaving(false); }
  };

  // Mở panel thêm biến thể
  const openAddVariant = async (product) => {
    setAddVarProductId(product.id);
    setAddVarProductName(product.name);
    setAddVarList([{ color:"",storage:"",ram:"",price:"",stock:"",cpu:"",os:"",screenSize:"",screenTech:"",refreshRate:"",battery:"",chargingSpeed:"",frontCamera:"",rearCamera:"",weights:"",updates:"",imageFile:null,imagePreview:"" }]);
    setAddVarErrors({});
    // Load biến thể hiện có
    try {
      const res  = await fetch(`${API}/api/product/${product.id}/variants/`);
      const data = await res.json();
      if (res.ok) setExistingVariants(data.variants || []);
    } catch { setExistingVariants([]); }
  };

  const handleSaveAddVariant = async () => {
    const errs = {};
    const variantErrs = addVarList.map((v) => {
      const ve = {};
      if (!v.price || isNaN(v.price) || parseFloat(v.price) <= 0) ve.price = "Giá phải lớn hơn 0";
      if (!v.stock || isNaN(v.stock) || parseInt(v.stock) <= 0)   ve.stock = "Số lượng phải lớn hơn 0";
      else if (parseInt(v.stock) > 10000)                          ve.stock = "Tối đa 10.000";
      if (!v.ram) { ve.ram = "Vui lòng nhập RAM"; }
      else { const m = String(v.ram).match(/^(\d+(?:\.\d+)?)GB$/i); if (!m || parseFloat(m[1]) <= 4) ve.ram = "RAM phải > 4GB"; }
      if (v.storage) { const m = String(v.storage).match(/^(\d+(?:\.\d+)?)(GB|TB)$/i); if (!m) ve.storage = "Dạng số + GB/TB"; else if (m[2].toUpperCase()==="GB"&&parseFloat(m[1])<64) ve.storage="Tối thiểu 64GB"; else if (m[2].toUpperCase()==="TB"&&parseFloat(m[1])<1) ve.storage="Tối thiểu 1TB"; }
      return ve;
    });
    if (variantErrs.some((ve) => Object.keys(ve).length > 0)) errs.variantDetails = variantErrs;
    setAddVarErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setAddVarSaving(true);
    try {
      const formData = new FormData();
      formData.append("product_id", addVarProductId);
      const clean = addVarList.map(({ imageFile, imagePreview, ...rest }) => rest);
      formData.append("variants", JSON.stringify(clean));
      addVarList.forEach((v, i) => { if (v.imageFile) formData.append(`variant_image_${i}`, v.imageFile); });
      const res  = await fetch(`${API}/api/product/add-variants/`, { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setAddVarProductId(null);
        loadProducts();
        alert(`Đã thêm ${addVarList.length} biến thể thành công!`);
      } else { setAddVarErrors({ general: data.message }); }
    } finally { setAddVarSaving(false); }
  };

  const ORDER_STATUS_MAP = {
    Pending:    { label: "Chờ xác nhận",   color: "#ff9500", next: "Processing", nextLabel: "Xác nhận xử lý"  },
    Processing: { label: "Đang xử lý",     color: "#0a84ff", next: "Shipping",   nextLabel: "Bắt đầu giao"    },
    Shipping:   { label: "Đang giao hàng", color: "#30d158", next: "Delivered",  nextLabel: "Xác nhận đã giao" },
    Delivered:  { label: "Đã giao hàng",   color: "#34c759", next: null,         nextLabel: null               },
    Cancelled:  { label: "Đã hủy",         color: "#ff3b30", next: null,         nextLabel: null               },
  };

  const POST_CATEGORIES = ["Mẹo vặt", "Mới nhất", "Đánh giá", "Tin tức"];

  const loadPosts = async () => {
    setPostLoading(true);
    try {
      const res  = await fetch(`${API}/api/post/list/?category=all`);
      const data = await res.json();
      setPostList(data.posts || []);
    } catch { /* ignore */ }
    finally { setPostLoading(false); }
  };

  const savePost = async () => {
    if (!postForm.title.trim()) { alert("Vui lòng nhập tiêu đề"); return; }
    setPostSaving(true);
    try {
      const fd = new FormData();
      fd.append("title",    postForm.title);
      fd.append("category", postForm.category);
      fd.append("author",   adminLocal?.fullName || adminLocal?.full_name || "Admin");
      const blocksClean = postForm.blocks.map(({ _pendingFile, file, ...rest }) => rest);
      fd.append("blocks",   JSON.stringify(blocksClean));
      Object.entries(postForm.mediaFiles).forEach(([key, file]) => { if (file) fd.append(key, file); });
      if (editingPost) fd.append("post_id", editingPost.id);
      const url = editingPost ? `${API}/api/post/update/` : `${API}/api/post/create/`;
      const res = await fetch(url, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setShowPostForm(false); setEditingPost(null);
        setPostForm({ title: "", category: "Mẹo vặt", blocks: [], mediaFiles: {} });
        loadPosts();
      } else alert(data.message);
    } catch { alert("Lỗi kết nối"); }
    finally { setPostSaving(false); }
  };

  const deletePost = async (postId) => {
    if (!window.confirm("Xóa bài viết này?")) return;
    const res = await fetch(`${API}/api/post/delete/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ post_id: postId }) });
    if (res.ok) setPostList(p => p.filter(x => x.id !== postId));
    else { const d = await res.json(); alert(d.message); }
  };

  const loadProductContent = async (pid) => {
    if (!pid) return;
    setPcLoaded(false);
    try {
      const res  = await fetch(`${API}/api/product/${pid}/content/`);
      const data = await res.json();
      setPcBlocks(data.content?.blocks || []);
      setPcMediaFiles({});
      setPcLoaded(true);
    } catch { setPcBlocks([]); setPcLoaded(true); }
  };

  const saveProductContent = async () => {
    if (!pcProductId) { alert("Vui lòng chọn sản phẩm"); return; }
    setPcSaving(true);
    try {
      const fd = new FormData();
      fd.append("product_id", pcProductId);
      const blocksClean = pcBlocks.map(({ _pendingFile, file, ...rest }) => rest);
      fd.append("blocks", JSON.stringify(blocksClean));
      Object.entries(pcMediaFiles).forEach(([key, file]) => { if (file) fd.append(key, file); });
      const res  = await fetch(`${API}/api/product/content/save/`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) alert("✅ " + data.message);
      else        alert(data.message);
    } catch { alert("Lỗi kết nối"); }
    finally { setPcSaving(false); }
  };

  const RETURN_STATUS_MAP = {
    Pending:   { label: "Chờ xét duyệt",         color: "#ff9500" },
    Approved:  { label: "Đã chấp nhận",           color: "#34c759" },
    Rejected:  { label: "Đã từ chối",             color: "#ff3b30" },
    Returning: { label: "Đang nhận hàng hoàn về", color: "#0a84ff" },
    Completed: { label: "Hoàn tất",               color: "#34c759" },
  };

  const RETURN_ACTIONS = {
    Pending:   [
      { action: "approve",   label: "✅ Chấp nhận trả hàng", color: "#34c759", bg: "rgba(52,199,89,0.1)",  border: "rgba(52,199,89,0.3)"  },
      { action: "reject",    label: "❌ Từ chối",             color: "#ff3b30", bg: "rgba(255,59,48,0.1)",  border: "rgba(255,59,48,0.3)"  },
    ],
    Approved:  [
      { action: "returning", label: "📦 Đang nhận hàng về",  color: "#0a84ff", bg: "rgba(10,132,255,0.1)", border: "rgba(10,132,255,0.3)" },
    ],
    Returning: [
      { action: "complete",  label: "✅ Hoàn tất — cộng lại kho", color: "#34c759", bg: "rgba(52,199,89,0.1)", border: "rgba(52,199,89,0.3)" },
    ],
  };

  const loadReturns = async () => {
    setReturnLoading(true);
    try {
      const res  = await fetch(`${API}/api/order/return/list/`);
      const data = await res.json();
      setReturnList(data.returns || []);
    } catch { /* ignore */ }
    finally { setReturnLoading(false); }
  };

  const handleProcessReturn = async (returnId, action) => {
    setProcessingReturn(true);
    try {
      const res  = await fetch(`${API}/api/order/return/process/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ return_id: returnId, action, note: returnNote }),
      });
      const data = await res.json();
      if (res.ok) {
        const statusAfter = { approve: "Approved", reject: "Rejected", returning: "Returning", complete: "Completed" }[action];
        setReturnList(p => p.map(r => r.return_id === returnId ? { ...r, status: statusAfter, admin_note: returnNote } : r));
        if (returnDetail?.return_id === returnId) setReturnDetail(d => ({ ...d, status: statusAfter, admin_note: returnNote }));
        setReturnNote("");
        alert(data.message);
      } else alert(data.message);
    } catch { alert("Lỗi kết nối"); }
    finally { setProcessingReturn(false); }
  };

  const loadOrders = async () => {
    setOrderLoading(true);
    try {
      const res  = await fetch(`${API}/api/order/admin/list/`);
      const data = await res.json();
      setOrderList(data.orders || []);
    } catch { /* ignore */ }
    finally { setOrderLoading(false); }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    setUpdatingOrder(orderId);
    try {
      const res  = await fetch(`${API}/api/order/update-status/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, status: newStatus, note: statusNote }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrderList((p) => p.map((o) => o.id === orderId ? { ...o, status: newStatus, status_note: statusNote } : o));
        if (orderDetail?.id === orderId) setOrderDetail((d) => ({ ...d, status: newStatus, status_note: statusNote }));
        setStatusNote("");
      } else alert(data.message);
    } catch { alert("Lỗi kết nối"); }
    finally { setUpdatingOrder(null); }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm("Hủy đơn hàng này?")) return;
    setUpdatingOrder(orderId);
    try {
      const res  = await fetch(`${API}/api/order/update-status/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, status: "Cancelled", note: "Admin hủy đơn" }),
      });
      if (res.ok) setOrderList((p) => p.map((o) => o.id === orderId ? { ...o, status: "Cancelled" } : o));
      else { const d = await res.json(); alert(d.message); }
    } catch { alert("Lỗi kết nối"); }
    finally { setUpdatingOrder(null); }
  };

  const loadVouchers = async () => {
    setVoucherLoading(true);
    try {
      const res  = await fetch(`${API}/api/voucher/list/`);
      const data = await res.json();
      if (res.ok) setVoucherList(data.vouchers || []);
    } finally { setVoucherLoading(false); }
  };

  const handleSaveVoucher = async () => {
    if (!newVoucher.code.trim()) { alert("Vui lòng nhập mã voucher"); return; }
    if (!newVoucher.value || parseFloat(newVoucher.value) <= 0) { alert("Vui lòng nhập giá trị voucher"); return; }
    setVoucherSaving(true);
    try {
      const res  = await fetch(`${API}/api/voucher/create/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newVoucher, value: parseFloat(newVoucher.value) }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddVoucher(false);
        setNewVoucher({ code:"",type:"percent",value:"",scope:"all",category_id:"",product_id:"",min_order:"",max_discount:"",start_date:"",end_date:"",usage_limit:"" });
        loadVouchers();
        alert("Tạo voucher thành công!");
      } else { alert(data.message); }
    } finally { setVoucherSaving(false); }
  };

  const deactivateVoucher = async (id) => {
    const res = await fetch(`${API}/api/voucher/deactivate/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) loadVouchers();
  };

  const loadImportVariants = async (productId) => {
    if (!productId) return;
    setImportLoading(true);
    try {
      const res  = await fetch(`${API}/api/product/${productId}/variants/`);
      const data = await res.json();
      if (res.ok) { setImportVariants(data.variants || []); setImportQty({}); }
    } finally { setImportLoading(false); }
  };

  const loadCategories = async () => {
    setCatLoading(true);
    try {
      const res  = await fetch(`${API}/api/product/categories/`);
      const data = await res.json();
      if (res.ok) setCatList(data.categories || []);
    } finally { setCatLoading(false); }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) { alert("Vui lòng nhập tên danh mục"); return; }
    setCatSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", newCatName.trim());
      if (newCatImage) formData.append("image", newCatImage);
      const res  = await fetch(`${API}/api/product/category/create/`, { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setShowAddCat(false); setNewCatName(""); setNewCatImage(null); setNewCatPreview("");
        loadCategories();
        // Cập nhật categories cho dropdown tạo sản phẩm
        setCategories((prev) => [...prev, { id: data.id, name: data.name }]);
        alert("Tạo danh mục thành công!");
      } else { alert(data.message); }
    } finally { setCatSaving(false); }
  };

  const handleSaveCatEdit = async (catId) => {
    if (!editCatName.trim()) { alert("Vui lòng nhập tên danh mục"); return; }
    setCatSaving(true);
    try {
      const formData = new FormData();
      formData.append("id", catId);
      formData.append("name", editCatName.trim());
      if (editCatImage) formData.append("image", editCatImage);
      const res  = await fetch(`${API}/api/product/category/update/`, { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setEditCatId(null); setEditCatName(""); setEditCatImage(null); setEditCatPreview("");
        loadCategories();
      } else { alert(data.message); }
    } finally { setCatSaving(false); }
  };

    const handleImport = async () => {
    const entries = Object.entries(importQty).filter(([, q]) => parseInt(q) > 0);
    if (entries.length === 0) { alert("Chưa nhập số lượng cho biến thể nào"); return; }
    setImportSaving(true);
    try {
      const res  = await fetch(`${API}/api/product/import/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: entries.map(([variantId, qty]) => ({ variant_id: parseInt(variantId), quantity: parseInt(qty) })) }),
      });
      const data = await res.json();
      if (res.ok) { alert("Nhập hàng thành công!"); loadImportVariants(importProductId); }
      else        { alert(data.message); }
    } finally { setImportSaving(false); }
  };

  // ===== ĐỔI AVATAR =====
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Vui lòng chọn file ảnh"); return; }
    if (file.size > 5 * 1024 * 1024)    { alert("Ảnh không được vượt quá 5MB"); return; }

    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append("id", adminLocal.id);
      formData.append("avatar_file", file);
      const res  = await fetch(`${API}/api/staff/upload-avatar/`, { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setAdmin((prev) => ({ ...prev, avatar: data.avatar_url }));
        const stored  = JSON.parse(localStorage.getItem("admin_user") || "{}");
        localStorage.setItem("admin_user", JSON.stringify({ ...stored, avatar: data.avatar_url }));
        window.dispatchEvent(new Event("userUpdated"));
      } else { alert(data.message); }
    } catch { alert("Không thể kết nối server"); }
    finally  { setAvatarLoading(false); }
  };

  // ===== ĐỔI MẬT KHẨU =====
  const savePassword = async () => {
    const newErr = {};
    if (!passForm.current)                   newErr.current = "Vui lòng nhập mật khẩu hiện tại";
    if (!passForm.newPass)                   newErr.newPass = "Vui lòng nhập mật khẩu mới";
    else if (passForm.newPass.includes(" ")) newErr.newPass = "Không được chứa dấu cách";
    else if (passForm.newPass.length < 6)    newErr.newPass = "Ít nhất 6 ký tự";
    if (!passForm.confirm)                   newErr.confirm = "Vui lòng nhập lại";
    else if (passForm.newPass !== passForm.confirm) newErr.confirm = "Không trùng khớp";
    setErrors(newErr);
    if (Object.keys(newErr).length > 0) return;

    setSaving(true);
    try {
      const res  = await fetch(`${API}/api/staff/change-password/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: adminLocal.id, current_password: passForm.current, new_password: passForm.newPass }),
      });
      const data = await res.json();
      if (res.ok) { setEditPass(false); setPassForm({ current: "", newPass: "", confirm: "" }); setErrors({}); alert("Đổi mật khẩu thành công!"); }
      else setErrors({ current: data.message });
    } finally { setSaving(false); }
  };

  // ===== THÊM NHÂN VIÊN =====
  const handleAddStaff = async () => {
    const errs = {};
    if (!newStaff.fullname.trim()) errs.fullname = "Vui lòng nhập họ tên";
    if (!newStaff.email.trim())    errs.email    = "Vui lòng nhập email";
    if (!newStaff.password.trim()) errs.password = "Vui lòng nhập mật khẩu";
    else if (newStaff.password.length < 6) errs.password = "Ít nhất 6 ký tự";
    setNewStaffErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const res  = await fetch(`${API}/api/staff/create/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: newStaff.fullname, email: newStaff.email, password: newStaff.password, role: newStaff.role }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddStaff(false);
        setNewStaff({ fullname: "", email: "", password: "", role: "Staff" });
        loadStaff();
        alert("Tạo tài khoản thành công!");
      } else { setNewStaffErrors({ general: data.message }); }
    } finally { setSaving(false); }
  };

  // ===== ĐỔI QUYỀN NHÂN VIÊN =====
  const changeRole = async (staffId, newRole) => {
    try {
      const res = await fetch(`${API}/api/staff/update-role/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: staffId, role: newRole }),
      });
      if (res.ok) loadStaff();
    } catch { alert("Lỗi cập nhật quyền"); }
  };

  const handleLogout = () => { localStorage.removeItem("admin_user"); navigate("/admin/login"); };

  const ROLE_COLOR = {
    Admin:      "bg-orange-500/20 text-orange-300 border-orange-500/30",
    Staff:      "bg-blue-500/20 text-blue-300 border-blue-500/30",
    Unentitled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };

  const menuItems = [
    { key: "profile",  label: "Thông tin cá nhân",  icon: User },
    { key: "staff",    label: "Quản lý nhân viên",   icon: Users },
    { key: "category", label: "Danh mục sản phẩm",   icon: LayoutGrid },
    { key: "product",  label: "Quản lý sản phẩm",    icon: Package },
    { key: "import",   label: "Nhập hàng",            icon: PackagePlus },
    { key: "orders",   label: "Đơn hàng",              icon: ShoppingBag },
    { key: "returns",  label: "Trả hàng",               icon: RotateCcw },
    { key: "voucher",  label: "Voucher",               icon: Ticket },
    { key: "posts",    label: "Bài viết",              icon: Newspaper },
    { key: "product_content", label: "Mô tả sản phẩm", icon: FileText },
    { key: "settings", label: "Cài đặt",              icon: Settings },
  ];

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">

      {/* ===== HỘP THOẠI ĐĂNG XUẤT ===== */}
      {confirmLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmLogout(false)} />
          <div className="relative bg-[#161616] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <h3 className="font-semibold">Đăng xuất</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">Bạn có muốn đăng xuất khỏi trang quản trị không?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmLogout(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition border border-white/10">Hủy</button>
              <button onClick={handleLogout}
                className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium transition">Đăng xuất</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== SIDEBAR ===== */}
      <aside className="w-64 bg-[#111111] border-r border-white/5 flex flex-col min-h-screen">
        {/* Header */}
        <div className="px-6 py-6 border-b border-white/5">
          <p className="text-xs text-orange-400 font-medium tracking-widest uppercase mb-1">Quản trị</p>
          <h1 className="text-lg font-bold tracking-tight">PHONEZONE</h1>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center py-8 px-6 border-b border-white/5">
          <div className="relative group mb-3">
            {admin?.avatar ? (
              <img src={admin.avatar} alt="avatar"
                className="w-20 h-20 rounded-full object-cover ring-2 ring-orange-500/30" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <User size={32} className="text-orange-400/60" />
              </div>
            )}
            <button onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              {avatarLoading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Camera size={16} className="text-white" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <p className="font-semibold text-sm">{admin?.full_name}</p>
          <span className={`mt-1 text-xs px-2 py-0.5 rounded-full border ${ROLE_COLOR[admin?.role] || ROLE_COLOR.Staff}`}>
            {admin?.role}
          </span>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {menuItems.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition group
                ${activeTab === key
                  ? "bg-orange-500/15 text-orange-300 border border-orange-500/20"
                  : "text-white/40 hover:bg-white/5 hover:text-white"}`}>
              <span className="flex items-center gap-3"><Icon size={16} />{label}</span>
              <ChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition ${activeTab === key ? "opacity-100" : ""}`} />
            </button>
          ))}
        </nav>

        <div className="px-3 pb-6">
          <button onClick={() => setConfirmLogout(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition">
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 overflow-y-auto">

        {/* TOPBAR */}
        <div className="sticky top-0 z-10 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 px-8 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-white/80">
            {menuItems.find((m) => m.key === activeTab)?.label}
          </h2>
          <div className="flex items-center gap-2 text-xs text-white/30">
            <Shield size={12} className="text-orange-400" />
            {admin?.role}
          </div>
        </div>

        <div className="p-8">

          {/* ===== THÔNG TIN CÁ NHÂN ===== */}
          {activeTab === "profile" && (
            <div className="max-w-2xl flex flex-col gap-6">
              <AdminSection title="Thông tin tài khoản">
                <InfoRow label="Mã nhân viên" value={admin?.id} />
                <InfoRow label="Họ và tên"    value={admin?.full_name} />
                <InfoRow label="Email"         value={admin?.email} />
                <InfoRow label="Vai trò"
                  value={<span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLOR[admin?.role]}`}>{admin?.role}</span>} />
              </AdminSection>

              <AdminSection title="Đổi mật khẩu">
                {editPass ? (
                  <div className="flex flex-col gap-3 py-2">
                    <PwInput placeholder="Mật khẩu hiện tại" value={passForm.current}
                      show={showPass.current} onToggle={() => setShowPass((p) => ({ ...p, current: !p.current }))}
                      onChange={(v) => setPassForm((p) => ({ ...p, current: v }))} error={errors.current} />
                    <PwInput placeholder="Mật khẩu mới" value={passForm.newPass}
                      show={showPass.newPass} onToggle={() => setShowPass((p) => ({ ...p, newPass: !p.newPass }))}
                      onChange={(v) => setPassForm((p) => ({ ...p, newPass: v }))} error={errors.newPass} />
                    <PwInput placeholder="Nhập lại mật khẩu mới" value={passForm.confirm}
                      show={showPass.confirm} onToggle={() => setShowPass((p) => ({ ...p, confirm: !p.confirm }))}
                      onChange={(v) => setPassForm((p) => ({ ...p, confirm: v }))} error={errors.confirm} />
                    <div className="flex gap-2 mt-1">
                      <button onClick={savePassword} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50">
                        <Check size={14} /> Lưu
                      </button>
                      <button onClick={() => { setEditPass(false); setPassForm({ current: "", newPass: "", confirm: "" }); setErrors({}); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition">
                        <X size={14} /> Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between py-3">
                    <span className="text-white/30 text-sm tracking-widest">••••••••</span>
                    <button onClick={() => setEditPass(true)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs transition">
                      <Pencil size={12} /> Đổi mật khẩu
                    </button>
                  </div>
                )}
              </AdminSection>
            </div>
          )}

          {/* ===== QUẢN LÝ NHÂN VIÊN ===== */}
          {activeTab === "staff" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/40">{staffList.length} tài khoản</p>
                <button onClick={() => setShowAddStaff(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition">
                  <Plus size={16} /> Thêm nhân viên
                </button>
              </div>

              {/* Form thêm nhân viên */}
              {showAddStaff && (
                <div className="bg-[#161616] border border-white/10 rounded-2xl p-6">
                  <h3 className="font-semibold mb-4 text-sm">Tạo tài khoản mới</h3>
                  {newStaffErrors.general && <p className="text-red-400 text-xs mb-3">{newStaffErrors.general}</p>}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input placeholder="Họ và tên" value={newStaff.fullname}
                        onChange={(e) => setNewStaff((p) => ({ ...p, fullname: e.target.value }))}
                        className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition
                          ${newStaffErrors.fullname ? "border-red-500/50" : "border-white/10"}`} />
                      {newStaffErrors.fullname && <p className="text-red-400 text-xs mt-1">{newStaffErrors.fullname}</p>}
                    </div>
                    <div>
                      <input placeholder="Email" value={newStaff.email}
                        onChange={(e) => setNewStaff((p) => ({ ...p, email: e.target.value }))}
                        className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition
                          ${newStaffErrors.email ? "border-red-500/50" : "border-white/10"}`} />
                      {newStaffErrors.email && <p className="text-red-400 text-xs mt-1">{newStaffErrors.email}</p>}
                    </div>
                    <div>
                      <input placeholder="Mật khẩu" type="password" value={newStaff.password}
                        onChange={(e) => setNewStaff((p) => ({ ...p, password: e.target.value }))}
                        className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition
                          ${newStaffErrors.password ? "border-red-500/50" : "border-white/10"}`} />
                      {newStaffErrors.password && <p className="text-red-400 text-xs mt-1">{newStaffErrors.password}</p>}
                    </div>
                    <div>
                      <select value={newStaff.role} onChange={(e) => setNewStaff((p) => ({ ...p, role: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition">
                        <option value="Staff">Staff</option>
                        <option value="Admin">Admin</option>
                        <option value="Unentitled">Unentitled</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={handleAddStaff} disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50">
                      <Check size={14} /> Tạo tài khoản
                    </button>
                    <button onClick={() => { setShowAddStaff(false); setNewStaffErrors({}); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition">
                      <X size={14} /> Hủy
                    </button>
                  </div>
                </div>
              )}

              {/* Danh sách nhân viên */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-4 px-6 py-3 border-b border-white/5 text-xs text-white/30 uppercase tracking-wider">
                  <span>Nhân viên</span><span>Email</span><span>Vai trò</span><span>Hành động</span>
                </div>
                {staffLoading ? (
                  <div className="py-12 flex justify-center">
                    <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                  </div>
                ) : staffList.length === 0 ? (
                  <div className="py-12 text-center text-white/20 text-sm">Chưa có nhân viên nào</div>
                ) : (
                  staffList.map((s) => (
                    <div key={s.id} className="grid grid-cols-4 px-6 py-4 border-b border-white/5 last:border-0 items-center hover:bg-white/2 transition">
                      <div className="flex items-center gap-3">
                        {s.avatar ? (
                          <img src={s.avatar} className="w-8 h-8 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                            <User size={14} className="text-white/30" />
                          </div>
                        )}
                        <span className="text-sm font-medium">{s.full_name}</span>
                      </div>
                      <span className="text-sm text-white/50">{s.email}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border w-fit ${ROLE_COLOR[s.role] || ROLE_COLOR.Staff}`}>{s.role}</span>
                      <select value={s.role} onChange={(e) => changeRole(s.id, e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-orange-500/50 w-fit">
                        <option value="Admin">Admin</option>
                        <option value="Staff">Staff</option>
                        <option value="Unentitled">Unentitled</option>
                      </select>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ===== QUẢN LÝ SẢN PHẨM ===== */}
          {/* ===== DANH MỤC SẢN PHẨM ===== */}
          {activeTab === "category" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/40">{catList.length} danh mục</p>
                <button onClick={() => { setShowAddCat(!showAddCat); setNewCatName(""); setNewCatImage(null); setNewCatPreview(""); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition">
                  <Plus size={16} /> {showAddCat ? "Đóng" : "Thêm danh mục"}
                </button>
              </div>

              {/* FORM THÊM DANH MỤC */}
              {showAddCat && (
                <div className="bg-[#161616] border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
                  <p className="text-sm font-medium text-orange-400">Danh mục mới</p>
                  <div className="flex items-start gap-5">
                    {/* Ảnh danh mục */}
                    <div>
                      <div onClick={() => catImageRef.current?.click()}
                        className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/15 hover:border-orange-500/50 flex flex-col items-center justify-center cursor-pointer transition overflow-hidden">
                        {newCatPreview
                          ? <img src={newCatPreview} alt="" className="w-full h-full object-cover" />
                          : <><Plus size={20} className="text-white/20 mb-1" /><span className="text-xs text-white/20">Ảnh</span></>
                        }
                      </div>
                      <input ref={catImageRef} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files[0]; if (f) { setNewCatImage(f); setNewCatPreview(URL.createObjectURL(f)); } }} />
                    </div>
                    {/* Tên */}
                    <div className="flex-1 flex flex-col gap-3">
                      <input placeholder="Tên danh mục *" value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition" />
                      <div className="flex gap-2">
                        <button onClick={handleAddCategory} disabled={catSaving}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50">
                          <Check size={14} /> {catSaving ? "Đang lưu..." : "Lưu"}
                        </button>
                        <button onClick={() => { setShowAddCat(false); setNewCatName(""); setNewCatImage(null); setNewCatPreview(""); }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition">
                          <X size={14} /> Hủy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DANH SÁCH DANH MỤC */}
              {catLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                </div>
              ) : catList.length === 0 ? (
                <div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center text-white/20">
                  <LayoutGrid size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Chưa có danh mục nào</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {catList.map((cat) => (
                    <div key={cat.id} className="bg-[#161616] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition">
                      {editCatId === cat.id ? (
                        /* EDIT MODE */
                        <div className="flex flex-col gap-3">
                          <div onClick={() => editCatImgRef.current?.click()}
                            className="w-full h-28 rounded-xl border-2 border-dashed border-white/15 hover:border-orange-500/50 flex items-center justify-center cursor-pointer overflow-hidden transition">
                            {editCatPreview
                              ? <img src={editCatPreview} alt="" className="w-full h-full object-cover" />
                              : cat.image
                                ? <img src={cat.image} alt="" className="w-full h-full object-cover" />
                                : <span className="text-xs text-white/20">Đổi ảnh</span>
                            }
                          </div>
                          <input ref={editCatImgRef} type="file" accept="image/*" className="hidden"
                            onChange={(e) => { const f = e.target.files[0]; if (f) { setEditCatImage(f); setEditCatPreview(URL.createObjectURL(f)); } }} />
                          <input value={editCatName} onChange={(e) => setEditCatName(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500/50" />
                          <div className="flex gap-2">
                            <button onClick={() => handleSaveCatEdit(cat.id)} disabled={catSaving}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-medium transition disabled:opacity-50">
                              <Check size={12} /> Lưu
                            </button>
                            <button onClick={() => { setEditCatId(null); setEditCatImage(null); setEditCatPreview(""); }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs transition">
                              <X size={12} /> Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* VIEW MODE */
                        <div className="flex flex-col gap-3">
                          <div className="w-full h-28 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center">
                            {cat.image
                              ? <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                              : <LayoutGrid size={32} className="text-white/10" />
                            }
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{cat.name}</p>
                              <p className="text-xs text-white/30 mt-0.5">#{cat.id}</p>
                            </div>
                            <button onClick={() => { setEditCatId(cat.id); setEditCatName(cat.name); setEditCatImage(null); setEditCatPreview(""); }}
                              className="p-2 rounded-xl hover:bg-white/5 text-white/30 hover:text-orange-400 transition">
                              <Pencil size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== QUẢN LÝ SẢN PHẨM ===== */}
          {activeTab === "product" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/40">{productList.length} sản phẩm</p>
                <button onClick={() => setShowAddProduct(!showAddProduct)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition">
                  <Plus size={16} /> {showAddProduct ? "Đóng" : "Thêm sản phẩm"}
                </button>
              </div>

              {showAddProduct && (
                <div className="bg-[#161616] border border-white/10 rounded-2xl p-6 flex flex-col gap-6">
                  <h3 className="font-semibold text-sm text-orange-400">Tạo sản phẩm mới</h3>
                  {productErrors.general && <p className="text-red-400 text-xs">{productErrors.general}</p>}

                  {/* THÔNG TIN CHUNG */}
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Thông tin chung</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <input placeholder="Tên sản phẩm *" value={newProduct.name}
                          onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                          className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition ${productErrors.name ? "border-red-500/50" : "border-white/10"}`} />
                        {productErrors.name && <p className="text-red-400 text-xs mt-1">{productErrors.name}</p>}
                      </div>
                      <input placeholder="Hãng sản xuất" value={newProduct.brand}
                        onChange={(e) => setNewProduct((p) => ({ ...p, brand: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition" />
                      <div>
                        <select value={newProduct.categoryId}
                          onChange={(e) => setNewProduct((p) => ({ ...p, categoryId: e.target.value }))}
                          className={`w-full bg-[#1e1e1e] border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition ${productErrors.categoryId ? "border-red-500/50" : "border-white/10"}`}>
                          <option value="">-- Chọn danh mục *</option>
                          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {productErrors.categoryId && <p className="text-red-400 text-xs mt-1">{productErrors.categoryId}</p>}
                      </div>
                      <RichEditor
                        value={newProduct.description}
                        onChange={(html) => setNewProduct((p) => ({ ...p, description: html }))}
                      />
                    </div>
                  </div>

                  {/* ẢNH SẢN PHẨM */}
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Ảnh sản phẩm</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      {productImages.map((file, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 group">
                          <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => setProductImages((imgs) => imgs.filter((_, idx) => idx !== i))}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <X size={16} className="text-white" />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => productImageRef.current?.click()}
                        className="w-20 h-20 rounded-xl border border-dashed border-white/20 hover:border-orange-500/50 flex flex-col items-center justify-center text-white/30 hover:text-orange-400 transition text-xs gap-1">
                        <Plus size={20} /><span>Thêm</span>
                      </button>
                      <input ref={productImageRef} type="file" accept="image/*" multiple className="hidden"
                        onChange={(e) => setProductImages((prev) => [...prev, ...Array.from(e.target.files)])} />
                    </div>
                  </div>

                  {/* BIẾN THỂ */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-white/40 uppercase tracking-wider">
                        Biến thể sản phẩm ({variants.length})
                        {productErrors.variants && <span className="text-red-400 ml-2 normal-case">{productErrors.variants}</span>}
                      </p>
                      <button onClick={addVariant}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs transition">
                        <Plus size={12} /> Thêm biến thể
                      </button>
                    </div>

                    <div className="flex flex-col gap-4">
                      {variants.map((v, i) => (
                        <div key={i} className="border border-white/10 rounded-xl p-4 bg-white/2 relative">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-medium text-orange-400">Biến thể #{i + 1}</span>
                            {variants.length > 1 && (
                              <button onClick={() => removeVariant(i)}
                                className="text-red-400/60 hover:text-red-400 transition p-1 rounded-lg hover:bg-red-500/10">
                                <X size={14} />
                              </button>
                            )}
                          </div>

                          {/* ẢNH BIẾN THỂ */}
                          <div className="mb-3">
                            <p className="text-xs text-white/30 mb-2">Ảnh biến thể</p>
                            <div className="flex items-center gap-3">
                              {/* Preview */}
                              <div className="w-20 h-20 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                                {v.imagePreview
                                  ? <img src={v.imagePreview} alt="" className="w-full h-full object-cover" />
                                  : <Plus size={20} className="text-white/15" />}
                              </div>
                              <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs cursor-pointer transition">
                                  <Plus size={12} className="text-orange-400" />
                                  {v.imagePreview ? "Đổi ảnh" : "Chọn ảnh"}
                                  <input type="file" accept="image/*" className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files[0];
                                      if (!file) return;
                                      updateVariant(i, "imageFile",    file);
                                      updateVariant(i, "imagePreview", URL.createObjectURL(file));
                                    }} />
                                </label>
                                {v.imagePreview && (
                                  <button onClick={() => { updateVariant(i, "imageFile", null); updateVariant(i, "imagePreview", ""); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition">
                                    <X size={12} /> Xóa ảnh
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Thông tin cơ bản - luôn hiện */}
                          <div className="grid grid-cols-3 gap-3 mb-3">

                            {/* MÀU SẮC - chọn hoặc nhập */}
                            <ComboField
                              value={v.color}
                              onChange={(val) => updateVariant(i, "color", val)}
                              options={["Đen", "Trắng", "Xanh dương", "Xanh lá", "Đỏ", "Vàng", "Hồng", "Tím", "Xám", "Bạc", "Vàng đồng", "Titan tự nhiên", "Titan đen", "Titan trắng", "Titan sa mạc"]}
                              placeholder="Màu sắc"
                            />

                            {/* BỘ NHỚ - tách số + đơn vị */}
                            <StorageField
                              value={v.storage}
                              onChange={(val) => updateVariant(i, "storage", val)}
                              error={productErrors.variantDetails?.[i]?.storage}
                            />

                            {/* RAM - tách số + đơn vị GB */}
                            <RamField
                              value={v.ram}
                              onChange={(val) => updateVariant(i, "ram", val)}
                              error={productErrors.variantDetails?.[i]?.ram}
                            />

                            {/* GIÁ */}
                            <div>
                              <input placeholder="Giá (VNĐ) *" value={v.price}
                                onChange={(e) => updateVariant(i, "price", e.target.value)}
                                className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition
                                  ${productErrors.variantDetails?.[i]?.price ? "border-red-500/50" : "border-white/10"}`} />
                              {productErrors.variantDetails?.[i]?.price && (
                                <p className="text-red-400 text-xs mt-1">{productErrors.variantDetails[i].price}</p>
                              )}
                            </div>

                            {/* SỐ LƯỢNG */}
                            <div>
                              <input placeholder="Số lượng * (tối đa 10.000)" value={v.stock}
                                onChange={(e) => updateVariant(i, "stock", e.target.value)}
                                className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition
                                  ${productErrors.variantDetails?.[i]?.stock ? "border-red-500/50" : "border-white/10"}`} />
                              {productErrors.variantDetails?.[i]?.stock && (
                                <p className="text-red-400 text-xs mt-1">{productErrors.variantDetails[i].stock}</p>
                              )}
                            </div>
                          </div>

                          {/* Thông số kỹ thuật - có thể thu gọn */}
                          <details className="group">
                            <summary className="text-xs text-white/30 hover:text-white/60 cursor-pointer select-none list-none flex items-center gap-1 mb-3">
                              <ChevronRight size={12} className="group-open:rotate-90 transition-transform" />
                              Thông số kỹ thuật
                            </summary>
                            <div className="grid grid-cols-3 gap-3">
                              {[
                                { key: "cpu",           placeholder: "CPU" },
                                { key: "os",            placeholder: "Hệ điều hành" },
                                { key: "screenSize",    placeholder: "Kích thước màn hình" },
                                { key: "screenTech",    placeholder: "Công nghệ màn hình" },
                                { key: "refreshRate",   placeholder: "Tần số quét" },
                                { key: "battery",       placeholder: "Dung lượng pin" },
                                { key: "chargingSpeed", placeholder: "Tốc độ sạc" },
                                { key: "frontCamera",   placeholder: "Camera trước" },
                                { key: "rearCamera",    placeholder: "Camera sau" },
                                { key: "weights",       placeholder: "Trọng lượng" },
                                { key: "updates",       placeholder: "Cập nhật hệ điều hành" },
                              ].map(({ key, placeholder }) => (
                                <input key={key} placeholder={placeholder} value={v[key]}
                                  onChange={(e) => updateVariant(i, key, e.target.value)}
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition" />
                              ))}
                            </div>
                          </details>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-white/5">
                    <button onClick={handleSaveProduct} disabled={productSaving}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50">
                      <Check size={14} /> {productSaving ? "Đang lưu..." : "Lưu sản phẩm"}
                    </button>
                    <button onClick={() => { setShowAddProduct(false); setProductErrors({}); }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition">
                      <X size={14} /> Hủy
                    </button>
                  </div>
                </div>
              )}

              {/* DANH SÁCH SẢN PHẨM */}
              {productLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                </div>
              ) : productList.length === 0 ? (
                <div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center text-white/20">
                  <Package size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Chưa có sản phẩm nào</p>
                </div>
              ) : (
                <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="grid grid-cols-5 px-6 py-3 border-b border-white/5 text-xs text-white/30 uppercase tracking-wider">
                    <span className="col-span-2">Sản phẩm</span><span>Hãng</span><span>Biến thể</span><span>Danh mục</span>
                  </div>
                  {productList.map((p) => (
                    <div key={p.id} className="border-b border-white/5 last:border-0">
                      <div className="grid grid-cols-5 px-6 py-4 items-center hover:bg-white/2 transition">
                        <div className="col-span-2">
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-white/30 mt-0.5">#{p.id}</p>
                        </div>
                        <span className="text-sm text-white/50">{p.brand || "—"}</span>
                        <span className="text-sm text-white/50">{p.variant_count} biến thể</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10">{p.category}</span>
                          <button onClick={() => addVarProductId === p.id ? setAddVarProductId(null) : openAddVariant(p)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition border
                              ${addVarProductId === p.id
                                ? "bg-white/10 border-white/20 text-white/50"
                                : "bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20"}`}>
                            <Plus size={11} /> {addVarProductId === p.id ? "Đóng" : "Thêm BT"}
                          </button>
                        </div>
                      </div>

                      {/* PANEL THÊM BIẾN THỂ */}
                      {addVarProductId === p.id && (
                        <div className="mx-4 mb-4 bg-[#1a1a1a] border border-orange-500/20 rounded-2xl p-5 flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-orange-400">Thêm biến thể cho: <span className="text-white">{addVarProductName}</span></p>
                            <button onClick={() => setAddVarList((l) => [...l, {color:"",storage:"",ram:"",price:"",stock:"",cpu:"",os:"",screenSize:"",screenTech:"",refreshRate:"",battery:"",chargingSpeed:"",frontCamera:"",rearCamera:"",weights:"",updates:"",imageFile:null,imagePreview:""}])}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs transition">
                              <Plus size={12} /> Thêm biến thể
                            </button>
                          </div>

                          {/* Biến thể hiện có */}
                          {existingVariants.length > 0 && (
                            <div>
                              <p className="text-xs text-white/30 mb-2">Biến thể hiện có ({existingVariants.length})</p>
                              <div className="flex flex-wrap gap-2">
                                {existingVariants.map((v) => (
                                  <span key={v.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/50">
                                    {[v.color, v.storage, v.ram].filter(Boolean).join(" / ") || `#${v.id}`}
                                    <span className="text-orange-400/60">{parseInt(v.price).toLocaleString("vi-VN")}đ</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {addVarErrors.general && <p className="text-red-400 text-xs">{addVarErrors.general}</p>}

                          {/* Form biến thể mới */}
                          <div className="flex flex-col gap-3">
                            {addVarList.map((v, vi) => (
                              <div key={vi} className="border border-white/10 rounded-xl p-4 bg-white/2">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-xs font-medium text-orange-400">Biến thể mới #{vi + 1}</span>
                                  {addVarList.length > 1 && (
                                    <button onClick={() => setAddVarList((l) => l.filter((_, idx) => idx !== vi))}
                                      className="text-red-400/60 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition">
                                      <X size={13} />
                                    </button>
                                  )}
                                </div>

                                {/* Ảnh */}
                                <div className="mb-3 flex items-center gap-3">
                                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                                    {v.imagePreview ? <img src={v.imagePreview} alt="" className="w-full h-full object-cover" /> : <Plus size={16} className="text-white/15" />}
                                  </div>
                                  <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs cursor-pointer transition">
                                    <Plus size={11} className="text-orange-400" />
                                    {v.imagePreview ? "Đổi ảnh" : "Chọn ảnh"}
                                    <input type="file" accept="image/*" className="hidden"
                                      onChange={(e) => { const f=e.target.files[0]; if(!f)return; setAddVarList((l)=>l.map((item,idx)=>idx===vi?{...item,imageFile:f,imagePreview:URL.createObjectURL(f)}:item)); }} />
                                  </label>
                                  {v.imagePreview && (
                                    <button onClick={() => setAddVarList((l)=>l.map((item,idx)=>idx===vi?{...item,imageFile:null,imagePreview:""}:item))}
                                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs transition hover:bg-red-500/20">
                                      <X size={11} /> Xóa
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-3 gap-3 mb-3">
                                  <ComboField value={v.color} onChange={(val)=>setAddVarList((l)=>l.map((item,idx)=>idx===vi?{...item,color:val}:item))}
                                    options={["Đen","Trắng","Xanh dương","Xanh lá","Đỏ","Vàng","Hồng","Tím","Xám","Bạc","Vàng đồng","Titan tự nhiên","Titan đen","Titan trắng","Titan sa mạc"]} placeholder="Màu sắc" />
                                  <StorageField value={v.storage} onChange={(val)=>setAddVarList((l)=>l.map((item,idx)=>idx===vi?{...item,storage:val}:item))} error={addVarErrors.variantDetails?.[vi]?.storage} />
                                  <RamField value={v.ram} onChange={(val)=>setAddVarList((l)=>l.map((item,idx)=>idx===vi?{...item,ram:val}:item))} error={addVarErrors.variantDetails?.[vi]?.ram} />
                                  <div>
                                    <input placeholder="Giá (VNĐ) *" value={v.price}
                                      onChange={(e)=>setAddVarList((l)=>l.map((item,idx)=>idx===vi?{...item,price:e.target.value}:item))}
                                      className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition ${addVarErrors.variantDetails?.[vi]?.price?"border-red-500/50":"border-white/10"}`} />
                                    {addVarErrors.variantDetails?.[vi]?.price && <p className="text-red-400 text-xs mt-1">{addVarErrors.variantDetails[vi].price}</p>}
                                  </div>
                                  <div>
                                    <input placeholder="Số lượng *" value={v.stock}
                                      onChange={(e)=>setAddVarList((l)=>l.map((item,idx)=>idx===vi?{...item,stock:e.target.value}:item))}
                                      className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition ${addVarErrors.variantDetails?.[vi]?.stock?"border-red-500/50":"border-white/10"}`} />
                                    {addVarErrors.variantDetails?.[vi]?.stock && <p className="text-red-400 text-xs mt-1">{addVarErrors.variantDetails[vi].stock}</p>}
                                  </div>
                                </div>

                                <details className="group">
                                  <summary className="text-xs text-white/30 hover:text-white/60 cursor-pointer select-none list-none flex items-center gap-1 mb-3">
                                    <ChevronRight size={12} className="group-open:rotate-90 transition-transform" /> Thông số kỹ thuật
                                  </summary>
                                  <div className="grid grid-cols-3 gap-3">
                                    {[["cpu","CPU"],["os","Hệ điều hành"],["screenSize","Kích thước MH"],["screenTech","Công nghệ MH"],["refreshRate","Tần số quét"],["battery","Pin"],["chargingSpeed","Tốc độ sạc"],["frontCamera","Camera trước"],["rearCamera","Camera sau"],["weights","Trọng lượng"],["updates","Cập nhật OS"]].map(([key,ph])=>(
                                      <input key={key} placeholder={ph} value={v[key]}
                                        onChange={(e)=>setAddVarList((l)=>l.map((item,idx)=>idx===vi?{...item,[key]:e.target.value}:item))}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition" />
                                    ))}
                                  </div>
                                </details>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-2 pt-2 border-t border-white/5">
                            <button onClick={handleSaveAddVariant} disabled={addVarSaving}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50">
                              <Check size={14} /> {addVarSaving ? "Đang lưu..." : `Lưu ${addVarList.length} biến thể`}
                            </button>
                            <button onClick={() => setAddVarProductId(null)}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition">
                              <X size={14} /> Hủy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== NHẬP HÀNG ===== */}
          {activeTab === "import" && (
            <div className="flex flex-col gap-6">
              <p className="text-sm text-white/40">Chọn sản phẩm để nhập thêm hàng</p>

              {/* Chọn sản phẩm */}
              <div className="bg-[#161616] border border-white/10 rounded-2xl p-5">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Chọn sản phẩm</p>
                <select value={importProductId}
                  onChange={(e) => { setImportProductId(e.target.value); loadImportVariants(e.target.value); }}
                  className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition">
                  <option value="">-- Chọn sản phẩm</option>
                  {productList.map((p) => <option key={p.id} value={p.id}>{p.name} {p.brand ? `(${p.brand})` : ""}</option>)}
                </select>
              </div>

              {/* Danh sách biến thể để nhập */}
              {importLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                </div>
              ) : importVariants.length > 0 && (
                <div className="flex flex-col gap-4">
                  <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-5 px-6 py-3 border-b border-white/5 text-xs text-white/30 uppercase tracking-wider">
                      <span className="col-span-2">Biến thể</span><span>Giá</span><span>Tồn kho</span><span>Nhập thêm</span>
                    </div>
                    {importVariants.map((v) => (
                      <div key={v.id} className="grid grid-cols-5 px-6 py-4 border-b border-white/5 last:border-0 items-center">
                        <div className="col-span-2">
                          <p className="text-sm font-medium">{[v.color, v.storage, v.ram].filter(Boolean).join(" / ") || `Variant #${v.id}`}</p>
                          <p className="text-xs text-white/30 mt-0.5">#{v.id}</p>
                        </div>
                        <span className="text-sm text-orange-300">{parseInt(v.price).toLocaleString("vi-VN")}đ</span>
                        <span className={`text-sm font-medium ${v.stock <= 5 ? "text-red-400" : "text-white/60"}`}>{v.stock}</span>
                        <input type="number" min="0" placeholder="0"
                          value={importQty[v.id] || ""}
                          onChange={(e) => setImportQty((q) => ({ ...q, [v.id]: e.target.value }))}
                          className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-orange-500/50 transition" />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 items-center">
                    <button onClick={handleImport} disabled={importSaving}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50">
                      <Check size={14} /> {importSaving ? "Đang nhập..." : "Xác nhận nhập hàng"}
                    </button>
                    <p className="text-xs text-white/30">
                      {Object.values(importQty).filter((q) => parseInt(q) > 0).length} biến thể được chọn
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}



          {/* ===== ĐƠN HÀNG ===== */}
          {activeTab === "orders" && (
            <div className="flex flex-col gap-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/40">Quản lý tất cả đơn hàng</p>
                <button onClick={loadOrders} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs transition">
                  <RefreshCw size={13} /> Làm mới
                </button>
              </div>

              {/* Chi tiết đơn hàng */}
              {orderDetail ? (
                <div className="flex flex-col gap-4">
                  <button onClick={() => setOrderDetail(null)} className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition w-fit">
                    ← Quay lại danh sách
                  </button>

                  <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-semibold">Đơn #{orderDetail.id}</p>
                        <p className="text-xs text-white/30 mt-0.5">{new Date(orderDetail.created_at).toLocaleString("vi-VN")}</p>
                        <p className="text-xs text-white/40 mt-1">KH: {orderDetail.customer_name} · {orderDetail.customer_phone}</p>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ color: ORDER_STATUS_MAP[orderDetail.status]?.color || "#fff", background: (ORDER_STATUS_MAP[orderDetail.status]?.color || "#fff") + "22" }}>
                        {ORDER_STATUS_MAP[orderDetail.status]?.label || orderDetail.status}
                      </span>
                    </div>

                    <p className="text-xs text-white/40 mb-4">📍 {orderDetail.shipping_address}</p>
                    <p className="text-xs text-white/30 mb-4">
                      {orderDetail.payment_method === "momo" ? "💜 MoMo" : "🚚 COD"}
                    </p>

                    {/* Sản phẩm */}
                    <div className="border border-white/5 rounded-xl overflow-hidden mb-4">
                      {(orderDetail.items || []).map((item, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0">
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/5" style={{ background: "#222" }}>
                            {item.image ? <img src={item.image} alt="" className="w-full h-full object-contain p-1" /> : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{item.product_name}</p>
                            <p className="text-[10px] text-white/30">{[item.color, item.storage, item.ram].filter(Boolean).join(" · ")} × {item.quantity}</p>
                          </div>
                          <p className="text-xs text-orange-400 shrink-0">{(parseFloat(item.unit_price) * item.quantity).toLocaleString("vi-VN")}đ</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-white/10 mb-5">
                      <span>Tổng thanh toán</span>
                      <span className="text-orange-400">{parseFloat(orderDetail.total_amount).toLocaleString("vi-VN")}đ</span>
                    </div>

                    {/* Cập nhật trạng thái */}
                    {ORDER_STATUS_MAP[orderDetail.status]?.next && (
                      <div className="border border-orange-500/20 rounded-xl p-4 bg-orange-500/5">
                        <p className="text-xs text-orange-400 font-medium mb-3">Cập nhật trạng thái đơn hàng</p>
                        <input placeholder="Ghi chú cho khách hàng (tùy chọn)" value={statusNote}
                          onChange={(e) => setStatusNote(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition mb-3" />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateOrderStatus(orderDetail.id, ORDER_STATUS_MAP[orderDetail.status].next)}
                            disabled={updatingOrder === orderDetail.id}
                            className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50">
                            {updatingOrder === orderDetail.id ? "Đang cập nhật..." : ORDER_STATUS_MAP[orderDetail.status].nextLabel}
                          </button>
                          {orderDetail.status === "Pending" && (
                            <button onClick={() => handleCancelOrder(orderDetail.id)}
                              className="px-4 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm transition">
                              Hủy đơn
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Danh sách đơn hàng */
                orderLoading ? (
                  <div className="text-center py-10 text-white/20 text-sm">Đang tải...</div>
                ) : orderList.length === 0 ? (
                  <div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center text-white/20">
                    <ShoppingBag size={36} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Chưa có đơn hàng nào</p>
                  </div>
                ) : (
                  <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-12 px-5 py-3 border-b border-white/5 text-xs text-white/30 uppercase tracking-wider">
                      <span className="col-span-1">#</span>
                      <span className="col-span-3">Khách hàng</span>
                      <span className="col-span-4">Địa chỉ</span>
                      <span className="col-span-2">Tổng tiền</span>
                      <span className="col-span-2">Trạng thái</span>
                    </div>
                    {orderList.map((order) => {
                      const sm = ORDER_STATUS_MAP[order.status] || {};
                      return (
                        <div key={order.id}
                          onClick={() => { setOrderDetail(order); setStatusNote(""); }}
                          className="grid grid-cols-12 px-5 py-3.5 border-b border-white/5 last:border-0 items-center hover:bg-white/3 transition cursor-pointer">
                          <span className="col-span-1 text-xs text-white/40">#{order.id}</span>
                          <div className="col-span-3">
                            <p className="text-sm font-medium truncate">{order.customer_name}</p>
                            <p className="text-xs text-white/30">{order.customer_phone}</p>
                          </div>
                          <p className="col-span-4 text-xs text-white/40 truncate pr-3">{order.shipping_address}</p>
                          <p className="col-span-2 text-sm font-medium text-orange-400">
                            {parseFloat(order.total_amount).toLocaleString("vi-VN")}đ
                          </p>
                          <span className="col-span-2 text-xs px-2 py-0.5 rounded-full font-medium w-fit"
                            style={{ color: sm.color || "#fff", background: (sm.color || "#fff") + "22" }}>
                            {sm.label || order.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          )}


          {/* ===== TRẢ HÀNG ===== */}
          {activeTab === "returns" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/40">Quản lý yêu cầu trả hàng từ khách</p>
                <button onClick={loadReturns}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs transition">
                  <RefreshCw size={13} /> Làm mới
                </button>
              </div>

              {returnDetail ? (
                /* ── CHI TIẾT YÊU CẦU TRẢ HÀNG ── */
                <div className="flex flex-col gap-4">
                  <button onClick={() => { setReturnDetail(null); setReturnNote(""); }}
                    className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition w-fit">
                    ← Quay lại danh sách
                  </button>

                  <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-semibold">Yêu cầu trả #R{returnDetail.return_id}</p>
                        <p className="text-xs text-white/30 mt-0.5">Đơn #{returnDetail.order_id} · {returnDetail.customer_name}</p>
                        <p className="text-xs text-white/20 mt-0.5">{new Date(returnDetail.created_at).toLocaleString("vi-VN")}</p>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{
                          color: RETURN_STATUS_MAP[returnDetail.status]?.color,
                          background: (RETURN_STATUS_MAP[returnDetail.status]?.color || "#fff") + "22"
                        }}>
                        {RETURN_STATUS_MAP[returnDetail.status]?.label || returnDetail.status}
                      </span>
                    </div>

                    {/* Lý do */}
                    <div className="bg-white/4 rounded-xl p-4 mb-4">
                      <p className="text-xs text-white/40 mb-1">Lý do khách hàng:</p>
                      <p className="text-sm text-white/80">{returnDetail.reason}</p>
                    </div>

                    {/* Media từ khách */}
                    {returnDetail.media?.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-white/40 mb-2">Bằng chứng ({returnDetail.media.length} file):</p>
                        <div className="flex gap-2 flex-wrap">
                          {returnDetail.media.map((m, i) => (
                            <a key={i} href={m.url} target="_blank" rel="noreferrer"
                              className="w-20 h-20 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center hover:border-orange-500/50 transition">
                              {m.type === "video"
                                ? <div className="flex flex-col items-center gap-1">
                                    <FileVideo size={22} className="text-purple-400" />
                                    <span className="text-[9px] text-white/30">Video</span>
                                  </div>
                                : <img src={m.url} alt="" className="w-full h-full object-cover" />}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Admin note cũ */}
                    {returnDetail.admin_note && (
                      <div className="bg-white/4 rounded-xl px-4 py-3 mb-4">
                        <p className="text-xs text-white/30">Ghi chú admin trước đó:</p>
                        <p className="text-sm text-white/60 italic mt-1">"{returnDetail.admin_note}"</p>
                      </div>
                    )}

                    {/* Actions */}
                    {RETURN_ACTIONS[returnDetail.status] && (
                      <div className="border border-white/8 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
                        <p className="text-xs text-white/40 mb-3 font-medium">Xử lý yêu cầu</p>
                        <input
                          placeholder="Ghi chú cho khách hàng (tùy chọn)"
                          value={returnNote}
                          onChange={e => setReturnNote(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition mb-3"
                        />

                        {/* Hướng dẫn luồng */}
                        <div className="flex items-start gap-2 mb-3 text-xs text-white/30">
                          <AlertCircle size={12} className="shrink-0 mt-0.5 text-orange-400/60" />
                          <span>
                            {returnDetail.status === "Pending" && "Chấp nhận → khách gửi hàng về. Từ chối → kết thúc yêu cầu, đơn về Đã giao."}
                            {returnDetail.status === "Approved" && "Xác nhận khi đã nhận được hàng từ khách gửi về."}
                            {returnDetail.status === "Returning" && "Hoàn tất → stock sẽ được cộng lại tự động."}
                          </span>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          {RETURN_ACTIONS[returnDetail.status].map(btn => (
                            <button key={btn.action}
                              onClick={() => handleProcessReturn(returnDetail.return_id, btn.action)}
                              disabled={processingReturn}
                              className="flex-1 min-w-[140px] py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50 border"
                              style={{ color: btn.color, background: btn.bg, borderColor: btn.border }}>
                              {processingReturn ? "Đang xử lý..." : btn.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Trạng thái cuối */}
                    {["Completed", "Rejected"].includes(returnDetail.status) && (
                      <div className="mt-3 text-center text-sm text-white/30 py-3 border border-white/5 rounded-xl">
                        {returnDetail.status === "Completed" ? "✅ Đã hoàn tất — stock đã được cộng lại" : "❌ Yêu cầu đã bị từ chối"}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ── DANH SÁCH YÊU CẦU TRẢ HÀNG ── */
                returnLoading ? (
                  <div className="text-center py-10 text-white/20 text-sm">Đang tải...</div>
                ) : returnList.length === 0 ? (
                  <div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center">
                    <RotateCcw size={36} className="mx-auto mb-3 text-white/10" />
                    <p className="text-sm text-white/20">Chưa có yêu cầu trả hàng nào</p>
                  </div>
                ) : (
                  <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-12 px-5 py-3 border-b border-white/5 text-xs text-white/30 uppercase tracking-wider">
                      <span className="col-span-1">#</span>
                      <span className="col-span-2">Đơn</span>
                      <span className="col-span-3">Khách hàng</span>
                      <span className="col-span-3">Lý do</span>
                      <span className="col-span-2">Ngày gửi</span>
                      <span className="col-span-1">T.Thái</span>
                    </div>
                    {returnList.map(rr => {
                      const sm = RETURN_STATUS_MAP[rr.status] || {};
                      return (
                        <div key={rr.return_id}
                          onClick={() => { setReturnDetail(rr); setReturnNote(""); }}
                          className="grid grid-cols-12 px-5 py-3.5 border-b border-white/5 last:border-0 items-center hover:bg-white/3 transition cursor-pointer">
                          <span className="col-span-1 text-xs text-white/40">#R{rr.return_id}</span>
                          <span className="col-span-2 text-xs text-white/60">#{rr.order_id}</span>
                          <div className="col-span-3">
                            <p className="text-sm font-medium truncate">{rr.customer_name}</p>
                          </div>
                          <p className="col-span-3 text-xs text-white/40 truncate pr-2">{rr.reason}</p>
                          <p className="col-span-2 text-xs text-white/30">{new Date(rr.created_at).toLocaleDateString("vi-VN")}</p>
                          <span className="col-span-1 text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ color: sm.color, background: (sm.color || "#fff") + "22" }}>
                            {rr.status === "Pending" ? "Mới" : rr.status === "Completed" ? "Xong" : rr.status === "Rejected" ? "Từ chối" : "..."}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          )}

          {/* ===== VOUCHER ===== */}
          {activeTab === "voucher" && (
            <div className="flex flex-col gap-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/40">Quản lý mã giảm giá</p>
                </div>
                <button onClick={() => setShowAddVoucher(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition">
                  <Plus size={14} /> Tạo voucher
                </button>
              </div>

              {/* Form tạo voucher */}
              {showAddVoucher && (
                <div className="bg-[#161616] border border-orange-500/20 rounded-2xl p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-orange-400">Tạo voucher mới</p>
                    <button onClick={() => setShowAddVoucher(false)} className="text-white/30 hover:text-white"><X size={16}/></button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Mã voucher */}
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Mã voucher *</label>
                      <input placeholder="VD: SUMMER2025" value={newVoucher.code}
                        onChange={(e) => setNewVoucher((p) => ({...p, code: e.target.value.toUpperCase()}))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition font-mono tracking-widest" />
                    </div>

                    {/* Loại giảm */}
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Loại giảm giá *</label>
                      <select value={newVoucher.type} onChange={(e) => setNewVoucher((p) => ({...p, type: e.target.value}))}
                        className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition">
                        <option value="percent">Phần trăm (%)</option>
                        <option value="fixed">Số tiền cố định (đ)</option>
                      </select>
                    </div>

                    {/* Giá trị */}
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">
                        Giá trị * {newVoucher.type === "percent" ? "(%) tối đa 100" : "(đ)"}
                      </label>
                      <input type="number" placeholder={newVoucher.type === "percent" ? "VD: 10" : "VD: 500000"} value={newVoucher.value}
                        onChange={(e) => setNewVoucher((p) => ({...p, value: e.target.value}))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition" />
                    </div>

                    {/* Phạm vi áp dụng */}
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Phạm vi áp dụng *</label>
                      <select value={newVoucher.scope} onChange={(e) => setNewVoucher((p) => ({...p, scope: e.target.value, category_id: "", product_id: ""}))}
                        className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition">
                        <option value="all">Toàn bộ sản phẩm</option>
                        <option value="category">Theo danh mục</option>
                        <option value="product">Theo sản phẩm</option>
                      </select>
                    </div>

                    {/* Chọn danh mục nếu scope = category */}
                    {newVoucher.scope === "category" && (
                      <div>
                        <label className="text-xs text-white/40 mb-1 block">Danh mục *</label>
                        <select value={newVoucher.category_id} onChange={(e) => setNewVoucher((p) => ({...p, category_id: e.target.value}))}
                          className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition">
                          <option value="">-- Chọn danh mục --</option>
                          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    )}

                    {/* Chọn sản phẩm nếu scope = product */}
                    {newVoucher.scope === "product" && (
                      <div>
                        <label className="text-xs text-white/40 mb-1 block">Sản phẩm *</label>
                        <select value={newVoucher.product_id} onChange={(e) => setNewVoucher((p) => ({...p, product_id: e.target.value}))}
                          className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition">
                          <option value="">-- Chọn sản phẩm --</option>
                          {productList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    )}

                    {/* Đơn hàng tối thiểu */}
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Đơn hàng tối thiểu (đ)</label>
                      <input type="number" placeholder="VD: 1000000" value={newVoucher.min_order}
                        onChange={(e) => setNewVoucher((p) => ({...p, min_order: e.target.value}))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition" />
                    </div>

                    {/* Giảm tối đa (chỉ với percent) */}
                    {newVoucher.type === "percent" && (
                      <div>
                        <label className="text-xs text-white/40 mb-1 block">Giảm tối đa (đ)</label>
                        <input type="number" placeholder="VD: 200000" value={newVoucher.max_discount}
                          onChange={(e) => setNewVoucher((p) => ({...p, max_discount: e.target.value}))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition" />
                      </div>
                    )}

                    {/* Ngày bắt đầu */}
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Ngày bắt đầu</label>
                      <input type="date" value={newVoucher.start_date}
                        onChange={(e) => setNewVoucher((p) => ({...p, start_date: e.target.value}))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition" />
                    </div>

                    {/* Ngày kết thúc */}
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Ngày kết thúc</label>
                      <input type="date" value={newVoucher.end_date}
                        onChange={(e) => setNewVoucher((p) => ({...p, end_date: e.target.value}))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition" />
                    </div>

                    {/* Giới hạn sử dụng */}
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Giới hạn lượt dùng</label>
                      <input type="number" placeholder="Để trống = không giới hạn" value={newVoucher.usage_limit}
                        onChange={(e) => setNewVoucher((p) => ({...p, usage_limit: e.target.value}))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition" />
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
                    <p className="text-xs text-white/30 mb-2">Xem trước</p>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-orange-400 font-bold text-base tracking-widest">{newVoucher.code || "VOUCHER"}</span>
                      <span className="text-white/40">—</span>
                      <span className="text-sm text-white/70">
                        Giảm {newVoucher.value || "??"}{newVoucher.type === "percent" ? "%" : "đ"}
                        {newVoucher.type === "percent" && newVoucher.max_discount ? ` (tối đa ${parseInt(newVoucher.max_discount).toLocaleString("vi-VN")}đ)` : ""}
                        {newVoucher.scope === "all" ? " cho toàn bộ" : newVoucher.scope === "category" ? " cho danh mục" : " cho sản phẩm"}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-white/5">
                    <button onClick={handleSaveVoucher} disabled={voucherSaving}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50">
                      <Check size={14} /> {voucherSaving ? "Đang lưu..." : "Tạo voucher"}
                    </button>
                    <button onClick={() => setShowAddVoucher(false)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition">
                      <X size={14} /> Hủy
                    </button>
                  </div>
                </div>
              )}

              {/* Danh sách voucher */}
              {voucherLoading ? (
                <div className="text-center py-10 text-white/20 text-sm">Đang tải...</div>
              ) : voucherList.length === 0 ? (
                <div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center text-white/20">
                  <Ticket size={36} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Chưa có voucher nào</p>
                </div>
              ) : (
                <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="grid grid-cols-6 px-5 py-3 border-b border-white/5 text-xs text-white/30 uppercase tracking-wider">
                    <span className="col-span-2">Mã</span>
                    <span>Giảm giá</span>
                    <span>Phạm vi</span>
                    <span>Hạn dùng</span>
                    <span>Trạng thái</span>
                  </div>
                  {voucherList.map((v) => (
                    <div key={v.id} className="grid grid-cols-6 px-5 py-4 border-b border-white/5 last:border-0 items-center hover:bg-white/2 transition">
                      <div className="col-span-2">
                        <p className="font-mono font-bold text-orange-400 tracking-widest">{v.code}</p>
                        {v.min_order > 0 && <p className="text-xs text-white/30 mt-0.5">Đơn tối thiểu: {parseInt(v.min_order).toLocaleString("vi-VN")}đ</p>}
                        <p className="text-xs text-white/20 mt-0.5">Đã dùng: {v.used_count}/{v.usage_limit || "∞"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-green-400">
                          -{v.type === "percent" ? `${v.value}%` : `${parseInt(v.value).toLocaleString("vi-VN")}đ`}
                        </p>
                        {v.type === "percent" && v.max_discount > 0 && (
                          <p className="text-xs text-white/30">Tối đa: {parseInt(v.max_discount).toLocaleString("vi-VN")}đ</p>
                        )}
                      </div>
                      <div>
                        {v.scope === "all"      && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">Tất cả</span>}
                        {v.scope === "category" && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">Danh mục</span>}
                        {v.scope === "product"  && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">Sản phẩm</span>}
                      </div>
                      <div className="text-xs text-white/40">
                        {v.end_date ? new Date(v.end_date).toLocaleDateString("vi-VN") : "Không giới hạn"}
                      </div>
                      <div className="flex items-center gap-2">
                        {v.is_active
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">Hiệu lực</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">Hết hạn</span>}
                        {v.is_active && (
                          <button onClick={() => deactivateVoucher(v.id)}
                            className="text-xs text-white/20 hover:text-red-400 transition px-2 py-0.5 rounded-lg hover:bg-red-500/10">
                            Vô hiệu
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* ===== BÀI VIẾT ===== */}
          {activeTab === "posts" && (
            <div className="flex flex-col gap-5">
              {showPostForm ? (
                /* FORM VIẾT BÀI */
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{editingPost ? "Chỉnh sửa bài viết" : "Bài viết mới"}</p>
                    <button onClick={() => { setShowPostForm(false); setEditingPost(null); setPostForm({ title: "", category: "Mẹo vặt", blocks: [], mediaFiles: {} }); }}
                      className="text-white/40 hover:text-white transition"><X size={18} /></button>
                  </div>

                  <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                    {/* Tiêu đề */}
                    <input value={postForm.title}
                      onChange={e => setPostForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="Tiêu đề bài viết *"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base font-semibold outline-none focus:border-orange-500/50 transition" />

                    {/* Category */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40 shrink-0">Danh mục:</span>
                      <div className="flex gap-2 flex-wrap">
                        {POST_CATEGORIES.map(cat => (
                          <button key={cat} onClick={() => setPostForm(p => ({ ...p, category: cat }))}
                            className="px-3 py-1 rounded-full text-xs transition"
                            style={{ background: postForm.category === cat ? "rgba(255,149,0,0.2)" : "rgba(255,255,255,0.05)", color: postForm.category === cat ? "#ff9500" : "rgba(255,255,255,0.4)", border: postForm.category === cat ? "1px solid rgba(255,149,0,0.4)" : "1px solid rgba(255,255,255,0.08)" }}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Block Editor */}
                    <div>
                      <p className="text-xs text-white/30 mb-3">Nội dung bài viết</p>
                      <Blockeditor
                        blocks={postForm.blocks}
                        onChange={blocks => setPostForm(p => ({ ...p, blocks }))}
                        mediaFiles={postForm.mediaFiles}
                        onMediaChange={mediaFiles => setPostForm(p => ({ ...p, mediaFiles }))}
                      />
                    </div>
                  </div>

                  <button onClick={savePost} disabled={postSaving}
                    className="py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 font-semibold text-sm transition">
                    {postSaving ? "Đang lưu..." : editingPost ? "Cập nhật bài viết" : "Đăng bài viết"}
                  </button>
                </div>
              ) : (
                /* DANH SÁCH BÀI VIẾT */
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/40">{postList.length} bài viết</p>
                    <button onClick={() => { setShowPostForm(true); setEditingPost(null); setPostForm({ title: "", category: "Mẹo vặt", blocks: [], mediaFiles: {} }); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition">
                      <Plus size={14} /> Viết bài mới
                    </button>
                  </div>

                  {postLoading ? (
                    <div className="text-center py-10 text-white/20 text-sm">Đang tải...</div>
                  ) : postList.length === 0 ? (
                    <div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center">
                      <Newspaper size={36} className="mx-auto mb-3 text-white/10" />
                      <p className="text-sm text-white/20">Chưa có bài viết nào</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {postList.map(post => (
                        <div key={post.id} className="bg-[#161616] border border-white/5 rounded-2xl flex items-center gap-4 px-5 py-4 hover:border-white/10 transition">
                          {post.thumbnail ? (
                            <img src={post.thumbnail} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                              <Newspaper size={20} className="text-white/15" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{post.title}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-orange-400/70">{post.category}</span>
                              <span className="text-xs text-white/30">{new Date(post.created_at).toLocaleDateString("vi-VN")}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => window.open(`/blog/${post.id}`, "_blank")}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => {
                                fetch(`${API}/api/post/${post.id}/`).then(r=>r.json()).then(d => {
                                  setEditingPost(post);
                                  setPostForm({ title: d.post.title, category: d.post.category, blocks: d.post.blocks, mediaFiles: {} });
                                  setShowPostForm(true);
                                });
                              }}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-orange-400 transition">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => deletePost(post.id)}
                              className="p-2 rounded-xl bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-400 transition">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ===== MÔ TẢ SẢN PHẨM RICH ===== */}
          {activeTab === "product_content" && (
            <div className="flex flex-col gap-5">
              <p className="text-sm text-white/40">Chọn sản phẩm và tạo mô tả chi tiết (ảnh, video, văn bản)</p>

              {/* Chọn sản phẩm */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
                <p className="text-xs text-white/40 mb-3 uppercase tracking-wider">Chọn sản phẩm</p>
                <div className="flex gap-3 items-center">
                  <select value={pcProductId}
                    onChange={e => { setPcProductId(e.target.value); if (e.target.value) loadProductContent(e.target.value); }}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition">
                    <option value="">-- Chọn sản phẩm --</option>
                    {productList.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Editor */}
              {pcProductId && pcLoaded && (
                <>
                  <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
                    <p className="text-xs text-white/40 mb-4 uppercase tracking-wider">Nội dung mô tả</p>
                    <Blockeditor
                      blocks={pcBlocks}
                      onChange={setPcBlocks}
                      mediaFiles={pcMediaFiles}
                      onMediaChange={setPcMediaFiles}
                    />
                  </div>
                  <button onClick={saveProductContent} disabled={pcSaving}
                    className="py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 font-semibold text-sm transition">
                    {pcSaving ? "Đang lưu..." : "Lưu mô tả sản phẩm"}
                  </button>
                </>
              )}

              {pcProductId && !pcLoaded && (
                <div className="text-center py-10 text-white/20 text-sm">Đang tải nội dung...</div>
              )}
            </div>
          )}

          {/* ===== CÀI ĐẶT ===== */}
          {activeTab === "settings" && (
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center text-white/20">
              <Settings size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Đang phát triển</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// ===== COMPONENT PHỤ =====
function AdminSection({ title, children }) {
  return (
    <div className="bg-[#161616] rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5">
        <h3 className="font-semibold text-sm text-white/70">{title}</h3>
      </div>
      <div className="px-6 py-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className="text-white/30 text-sm w-36 shrink-0">{label}</span>
      <span className="flex-1 text-sm">{value || <span className="text-white/20 italic">Chưa cập nhật</span>}</span>
    </div>
  );
}

function PwInput({ placeholder, value, show, onToggle, onChange, error }) {
  return (
    <div>
      <div className="relative">
        <input type={show ? "text" : "password"} placeholder={placeholder} value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 pr-10 text-sm outline-none focus:border-orange-500/50 transition
            ${error ? "border-red-500/50" : "border-white/10"}`} />
        <button type="button" onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-1 pl-1">{error}</p>}
    </div>
  );
}

// ===== COMBOFIELD: chọn từ gợi ý hoặc nhập tự do =====
function ComboField({ value, onChange, options, placeholder }) {
  const [open, setOpen]     = useState(false);
  const [input, setInput]   = useState(value || "");
  const ref                 = useRef(null);

  // Sync nếu value thay đổi từ bên ngoài
  useEffect(() => { setInput(value || ""); }, [value]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((o) => o.toLowerCase().includes(input.toLowerCase()));

  const handleInput = (e) => {
    setInput(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  };

  const handleSelect = (opt) => {
    setInput(opt);
    onChange(opt);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <input
        value={input}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition pr-8"
      />
      {/* Arrow toggle */}
      <button type="button" onClick={() => setOpen(!open)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d={open ? "M2 8l4-4 4 4" : "M2 4l4 4 4-4"} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-[#222] border border-white/10 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          {filtered.map((opt) => (
            <button key={opt} type="button" onClick={() => handleSelect(opt)}
              className={`w-full text-left px-3 py-2 text-sm transition hover:bg-orange-500/10 hover:text-orange-300
                ${input === opt ? "bg-orange-500/15 text-orange-300" : "text-white/70"}`}>
              {opt}
            </button>
          ))}
          {/* Nếu input không khớp với option nào → hiện "Dùng: ..." */}
          {input && !options.includes(input) && (
            <button type="button" onClick={() => { onChange(input); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-white/40 hover:bg-white/5 border-t border-white/5">
              Dùng: <span className="text-white/70">"{input}"</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ===== STORAGEFIELD: tách số và đơn vị GB/TB =====
function StorageField({ value, onChange, error }) {
  // Parse value -> num + unit
  const parse = (val) => {
    if (!val) return { num: "", unit: "GB" };
    const m = String(val).trim().match(/^(\d+(?:\.\d+)?)\s*(GB|TB)$/i);
    if (m) return { num: m[1], unit: m[2].toUpperCase() };
    return { num: val, unit: "GB" };
  };

  const [num,  setNum]  = useState(() => parse(value).num);
  const [unit, setUnit] = useState(() => parse(value).unit);

  useEffect(() => {
    const p = parse(value);
    setNum(p.num); setUnit(p.unit);
  }, [value]); // eslint-disable-line

  const handleNum = (e) => {
    const v = e.target.value.replace(/[^0-9]/g, "");
    setNum(v);
    onChange(v ? `${v}${unit}` : "");
  };

  const handleUnit = (e) => {
    setUnit(e.target.value);
    onChange(num ? `${num}${e.target.value}` : "");
  };

  // Gợi ý theo đơn vị
  const suggestions = unit === "GB"
    ? ["64", "128", "256", "512"]
    : ["1", "2"];

  return (
    <div>
      <div className={`flex items-center border rounded-lg overflow-hidden transition ${error ? "border-red-500/50" : "border-white/10"} bg-white/5`}>
        {/* Số */}
        <input
          type="text"
          inputMode="numeric"
          placeholder={unit === "GB" ? "≥ 64" : "≥ 1"}
          value={num}
          onChange={handleNum}
          list={`storage-list-${unit}`}
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none min-w-0"
        />
        <datalist id={`storage-list-${unit}`}>
          {suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
        {/* Đơn vị */}
        <select value={unit} onChange={handleUnit}
          className="bg-[#2a2a2a] border-l border-white/10 px-2 py-2 text-sm outline-none text-white/70 cursor-pointer">
          <option value="GB">GB</option>
          <option value="TB">TB</option>
        </select>
      </div>
      {error
        ? <p className="text-red-400 text-xs mt-1">{error}</p>
        : <p className="text-white/20 text-xs mt-1">{unit === "GB" ? "Tối thiểu 64GB" : "Tối thiểu 1TB"}</p>
      }
    </div>
  );
}

// ===== RAMFIELD: tách số và đơn vị GB (cố định) =====
function RamField({ value, onChange, error }) {
  const parse = (val) => {
    if (!val) return "";
    const m = String(val).trim().match(/^(\d+(?:\.\d+)?)\s*GB$/i);
    return m ? m[1] : val.replace(/GB/i, "").trim();
  };

  const [num, setNum] = useState(() => parse(value));

  useEffect(() => { setNum(parse(value)); }, [value]); // eslint-disable-line

  const handleNum = (e) => {
    const v = e.target.value.replace(/[^0-9]/g, "");
    setNum(v);
    onChange(v ? `${v}GB` : "");
  };

  return (
    <div>
      <div className={`flex items-center border rounded-lg overflow-hidden transition ${error ? "border-red-500/50" : "border-white/10"} bg-white/5`}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="> 4"
          value={num}
          onChange={handleNum}
          list="ram-list"
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none min-w-0"
        />
        <datalist id="ram-list">
          {["6", "8", "12", "16", "32"].map((s) => <option key={s} value={s} />)}
        </datalist>
        <span className="bg-[#2a2a2a] border-l border-white/10 px-3 py-2 text-sm text-white/50 select-none">GB</span>
      </div>
      {error
        ? <p className="text-red-400 text-xs mt-1">{error}</p>
        : <p className="text-white/20 text-xs mt-1">Tối thiểu lớn hơn 4GB</p>
      }
    </div>
  );
}