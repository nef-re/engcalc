from django.contrib import admin

from electrical.models import ElectricalSystem


@admin.register(ElectricalSystem)
class ElectricalSystemAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "u_nom_v", "earthing_system", "updated_at")
    search_fields = ("name",)
