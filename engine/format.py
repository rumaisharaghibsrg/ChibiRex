def rupiah(x: float | None) -> str:
    return "-" if x is None else f"Rp{x:,.0f}".replace(",", ".")


def angka(x: float, desimal: int = 1) -> str:
    """Desimal dengan koma, misalnya 32,8."""
    return f"{x:.{desimal}f}".replace(".", ",")
