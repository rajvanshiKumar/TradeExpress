"""Helpers for the offline fake handlers (development/test only)."""
import re
from datetime import date

_LINE = re.compile(r"^\s*([A-Za-z][A-Za-z .()/&-]{1,40}?)\s*[:=]\s*(.+?)\s*$")
_DMY = re.compile(r"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$")


def parse_kv(text: str) -> dict[str, str]:
    """'Label: value' lines -> {'label': 'value'} (lowercase labels)."""
    out: dict[str, str] = {}
    for line in text.splitlines():
        m = _LINE.match(line)
        if m:
            out.setdefault(m.group(1).strip().lower(), m.group(2).strip())
    return out


def pick(kv: dict[str, str], *labels: str) -> str | None:
    for label in labels:
        if label in kv:
            return kv[label]
    return None


def to_iso(value: str | None) -> str | None:
    """DD/MM/YYYY (Indian documents are day-first) or ISO -> YYYY-MM-DD."""
    if not value:
        return None
    v = value.strip()
    m = _DMY.match(v)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1))).isoformat()
        except ValueError:
            return None
    return v if re.fullmatch(r"\d{4}-\d{2}-\d{2}", v) else None
