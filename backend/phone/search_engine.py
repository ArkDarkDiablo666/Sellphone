"""
search_engine.py — Bộ máy tìm kiếm text cho PHONEZONE
Thuật toán: BM25 + Trigram fuzzy matching
Không cần thư viện ngoài, chỉ Python stdlib.
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
    return re.findall(r"[^\s\W]+", normalize(text), re.UNICODE)


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

            # Title nhân 3 để tăng trọng số
            body   = f"{title} {title} {title} {brand} {brand} {cat} {desc} {variant_text}"
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

        for term in q_tokens:
            postings = self.inverted.get(term, [])
            if postings:
                idf = self._idf(term)
                for doc_idx, tf in postings:
                    scores[doc_idx] += idf * self._tf_norm(tf, doc_idx)
            else:
                # Fuzzy
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

        # Title/brand bonus
        q_norm = normalize(query)
        for doc_idx, doc in enumerate(self.docs):
            title_n = normalize(doc["title"])
            brand_n = normalize(doc["brand"])
            if q_norm in title_n:
                scores[doc_idx] += 5.0
            elif q_norm in brand_n or brand_n in q_norm:
                scores[doc_idx] += 2.0
            else:
                for tok in q_tokens:
                    if tok in title_n:
                        scores[doc_idx] += 0.8

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
    # FIX: Product không có field IsActive — bỏ filter đó
    qs = Product.objects.select_related("CategoryID").prefetch_related("productvariant_set").all()
    _index.build(qs)
    _version += 1
    return _version


def get_version() -> int:
    return _version