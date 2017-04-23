from django import forms
from djangoql.models import Query


class QueryUpdateForm(forms.ModelForm):
    class Meta:
        model = Query
        fields = ('public', )
