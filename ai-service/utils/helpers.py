from fastapi import HTTPException


def require_non_empty_code(code: str) -> None:
    if not code or not code.strip():
        raise HTTPException(status_code=400, detail="Code must not be empty.")
