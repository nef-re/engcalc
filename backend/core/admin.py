from django.contrib import admin

from core.models import StandardReference


@admin.register(StandardReference)
class StandardReferenceAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "clause")
    search_fields = ("code", "title")
