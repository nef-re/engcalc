from django.contrib import admin

from catalog.models import (
    Cable,
    CableBrand,
    CircuitBreaker,
    DuctType,
    Fan,
    InstallationCondition,
    Transformer,
)


@admin.register(CableBrand)
class CableBrandAdmin(admin.ModelAdmin):
    search_fields = ("name",)


@admin.register(InstallationCondition)
class InstallationConditionAdmin(admin.ModelAdmin):
    list_display = ("name", "group_code", "ambient_temp_c", "k_temp", "k_group")


@admin.register(Cable)
class CableAdmin(admin.ModelAdmin):
    list_display = (
        "name", "construction", "section_mm2", "material", "gost_ref",
        "u_max_v", "outer_diameter_mm", "i_long_a", "r_mohm_per_m",
    )
    list_filter = ("brand", "material", "gost_ref", "construction")
    search_fields = ("name",)


@admin.register(CircuitBreaker)
class CircuitBreakerAdmin(admin.ModelAdmin):
    list_display = (
        "manufacturer", "series", "model_name", "category", "breaker_type",
        "in_a", "icu_ka", "ics_ka", "curve", "poles",
    )
    list_filter = ("manufacturer", "category", "breaker_type", "curve", "series")


@admin.register(Transformer)
class TransformerAdmin(admin.ModelAdmin):
    list_display = ("name", "s_kva", "uk_percent")


@admin.register(DuctType)
class DuctTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "shape", "roughness_mm")


@admin.register(Fan)
class FanAdmin(admin.ModelAdmin):
    list_display = ("manufacturer", "model_name", "q_max_m3h", "p_max_pa")
