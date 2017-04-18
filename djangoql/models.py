from django.db import models
from django.conf import settings
from django.contrib.contenttypes.models import ContentType


class Query(models.Model):
    text = models.TextField(
        verbose_name='saved query text')
    model = models.ForeignKey(
        ContentType, on_delete=models.CASCADE, verbose_name='related model')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name='query owner')
    public = models.BooleanField(
        default=False, verbose_name='makes this query publicly visible')
