from pydantic import BaseModel


class Incident(BaseModel):
    error: str
    fix: str
    outcome: str  # "success" or "fail"
    score: float = 0.0
    tags: list[str] = []


class StoreRequest(Incident):
    pass


class GenerateRequest(BaseModel):
    error: str
    tags: list[str] = []
