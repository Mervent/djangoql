import json

from django.conf.urls import url
from django.contrib import messages
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import FieldError, ValidationError
from django.db.models import Q
from django.http import HttpResponse
from django.views.generic import TemplateView

from djangoql.models import Query
from .compat import text_type
from .exceptions import DjangoQLError
from .queryset import apply_search
from .schema import DjangoQLSchema


class DjangoQLSearchMixin(object):
    search_fields = ('_djangoql',)  # just a stub to have search input displayed
    djangoql_completion = True
    djangoql_query_manager = True
    djangoql_schema = DjangoQLSchema
    djangoql_syntax_help_template = 'djangoql/syntax_help.html'

    def get_search_results(self, request, queryset, search_term):
        use_distinct = False
        if not search_term:
            return queryset, use_distinct
        try:
            return (
                apply_search(queryset, search_term, self.djangoql_schema),
                use_distinct,
            )
        except (DjangoQLError, ValueError, FieldError) as e:
            msg = text_type(e)
        except ValidationError as e:
            msg = e.messages[0]
        queryset = queryset.none()
        messages.add_message(request, messages.WARNING, msg)
        return queryset, use_distinct

    @property
    def media(self):
        media = super(DjangoQLSearchMixin, self).media
        if self.djangoql_completion:
            media.add_js((
                'djangoql/js/lib/lexer.js',
                'djangoql/js/completion.js',
                'djangoql/js/completion_admin.js',
            ))
            media.add_css({'': (
                'djangoql/css/completion.css',
                'djangoql/css/completion_admin.css',
            )})
        return media

    def get_urls(self):
        custom_urls = []
        if self.djangoql_completion:
            custom_urls += [
                url(
                    r'^introspect/$',
                    self.admin_site.admin_view(self.introspect),
                    name='%s_%s_djangoql_introspect' % (
                        self.model._meta.app_label,
                        self.model._meta.model_name,
                    ),
                ),
                url(
                    r'^djangoql-syntax/$',
                    TemplateView.as_view(
                        template_name=self.djangoql_syntax_help_template,
                    ),
                    name='djangoql_syntax_help',
                ),
            ]
        if self.djangoql_query_manager:
            custom_urls += [
                url(
                    r'save-query/$',
                    self.admin_site.admin_view(self.save_query),
                    name='%s_%s_djangoql_save_query' % (
                        self.model._meta.app_label,
                        self.model._meta.model_name,
                    ),
                ),
                url(
                    r'remove-query/$',
                    self.admin_site.admin_view(self.remove_query),
                    name='%s_%s_djangoql_remove_query' % (
                        self.model._meta.app_label,
                        self.model._meta.model_name,
                    ),
                ),
                url(
                    r'get-queries/$',
                    self.admin_site.admin_view(self.get_queries),
                    name='%s_%s_djangoql_get_queries' % (
                        self.model._meta.app_label,
                        self.model._meta.model_name,
                    ),
                )
            ]
        return custom_urls + super(DjangoQLSearchMixin, self).get_urls()

    def json_response(self, response, **kwargs):
        return HttpResponse(
            content=json.dumps(response, indent=2),
            content_type='application/json; charset=utf-8',
            **kwargs
        )

    def introspect(self, request):
        response = self.djangoql_schema(self.model).as_dict()
        return self.json_response(response)

    def get_current_content_type(self):
        return ContentType.objects.get(
            app_label=self.model._meta.app_label,
            model=self.model._meta.model_name
        )

    def get_queries(self, request):
        q = request.GET.get('q')
        queryset = Query.objects.filter(
            Q(model=self.get_current_content_type()) &
            (Q(user=request.user) | Q(public=True))
        ).values('id', 'text')
        if q:
            queryset = queryset.filter(text__icontains=q)

        response = {'results': list(queryset)}
        return self.json_response(response)

    def save_query(self, request):
        query = request.POST.get('query')
        public = request.POST.get('public', False)
        if query:
            content_type = self.get_current_content_type()
            Query.objects.update_or_create(
                text=query,
                user=request.user,
                model=content_type,
                defaults={'public': public}
            )
            return self.json_response({'success': True}, status=200)

        return self.json_response({'success': False}, status=400)

    def remove_query(self, request):
        query_id = request.POST.get('id')
        if query_id:
            Query.objects.filter(id=query_id, user=request.user).delete()
            return self.json_response({'success': True}, status=200)

        return self.json_response({'success': False}, status=400)

