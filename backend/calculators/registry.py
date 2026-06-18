from typing import Any

from calculators.base import BaseCalculator
from electrical.calculators import (
    BreakerSelectionCalculator,
    CableSectionCalculator,
    LoadCalculator,
    ShortCircuitCalculator,
    SystemCalculator,
    VoltageDropCalculator,
)

_REGISTRY: dict[str, BaseCalculator] = {}


def register(calc: BaseCalculator) -> None:
    _REGISTRY[calc.slug] = calc


def get_calculator(slug: str) -> BaseCalculator | None:
    return _REGISTRY.get(slug)


def list_calculators(discipline: str | None = None) -> list[dict[str, Any]]:
    from calculators.models import CalculatorDefinition

    items = sorted(_REGISTRY.values(), key=lambda c: (c.discipline, c.order))
    if discipline:
        items = [c for c in items if c.discipline == discipline]

    defns = {
        d.slug: d
        for d in CalculatorDefinition.objects.prefetch_related("standards").all()
    }

    result = []
    for c in items:
        meta = c.to_meta()
        defn = defns.get(c.slug)
        if defn:
            meta["standards"] = [
                {
                    "code": s.code,
                    "title": s.title,
                    "clause": s.clause,
                    "description": s.description,
                }
                for s in defn.standards.all()
            ]
        else:
            meta["standards"] = []
        result.append(meta)
    return result


def _bootstrap() -> None:
    for calc_cls in [
        LoadCalculator,
        CableSectionCalculator,
        VoltageDropCalculator,
        ShortCircuitCalculator,
        BreakerSelectionCalculator,
        SystemCalculator,
    ]:
        register(calc_cls())


_bootstrap()
