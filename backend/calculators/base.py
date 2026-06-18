from abc import ABC, abstractmethod
from typing import Any


class BaseCalculator(ABC):
    slug: str = ""
    discipline: str = ""
    name: str = ""
    description: str = ""
    order: int = 0
    standard_ref: str = ""

    @abstractmethod
    def input_schema(self) -> dict[str, Any]:
        pass

    @abstractmethod
    def calculate(self, data: dict[str, Any], catalog: dict[str, Any] | None = None) -> dict[str, Any]:
        pass

    def validate(self, data: dict[str, Any]) -> list[str]:
        return []

    def to_meta(self) -> dict[str, Any]:
        return {
            "slug": self.slug,
            "discipline": self.discipline,
            "name": self.name,
            "description": self.description,
            "order": self.order,
            "standard_ref": self.standard_ref,
        }
