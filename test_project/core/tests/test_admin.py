import json

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.test import TestCase
from djangoql.models import Query


class DjangoQLAdminTest(TestCase):
    def setUp(self):
        self.credentials = {'username': 'test', 'password': 'lol'}
        User.objects.create_superuser(email='herp@derp.rr', **self.credentials)

    def test_introspections(self):
        url = reverse('admin:core_book_djangoql_introspect')
        # unauthorized request should be redirected
        response = self.client.get(url)
        self.assertEqual(302, response.status_code)
        self.assertTrue(self.client.login(**self.credentials))
        # authorized request should be served
        response = self.client.get(url)
        self.assertEqual(200, response.status_code)
        introspections = json.loads(response.content.decode('utf8'))
        self.assertEqual('core.book', introspections['current_model'])
        for model in ('core.book', 'auth.user', 'auth.group'):
            self.assertIn(model, introspections['models'])

    def test_save_query(self):
        url = reverse('admin:core_book_djangoql_save_query')
        self.client.login(**self.credentials)
        response = self.client.post(
            url,
            data={'query': 'email = "sample@example.com"'}
        )

        self.assertEquals(200, response.status_code)
        self.assertEqual(Query.objects.count(), 1)

    def test_update_query_post_without_id_param_raises_404(self):
        self.client.login(**self.credentials)
        url = reverse('admin:core_book_djangoql_update_query')
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, 404)

    def test_toggle_public_query(self):
        self.client.login(**self.credentials)
        url = reverse('admin:core_book_djangoql_update_query')
        self.post_query("sample@example.com")

        query = Query.objects.first()
        self.assertFalse(query.public)

        self.client.post(url, data={'id': query.id, 'public': 'true'})
        query.refresh_from_db()
        self.assertTrue(query.public)

        self.client.post(url, data={'id': query.id, 'public': 'false'})
        query.refresh_from_db()
        self.assertFalse(query.public)

    def test_cannot_save_duplicate_queries(self):
        self.client.login(**self.credentials)
        self.post_query('email = "sample@example.com"')
        self.post_query('email = "sample@example.com"')

        self.assertEqual(Query.objects.count(), 1)

    def test_get_queries(self):
        url = reverse('admin:core_book_djangoql_get_queries')
        self.client.login(**self.credentials)
        self.post_query("sample1@example.com")
        self.post_query("sample2@example.com")

        response = self.client.get(url)
        self.assertEquals(200, response.status_code)
        response_json = json.loads(response.content.decode('utf-8'))
        self.assertEqual(len(response_json['results']['user']), 2)

    def test_get_queries_should_include_public_ones(self):
        get_url = reverse('admin:core_book_djangoql_get_queries')
        update_url = reverse('admin:core_book_djangoql_update_query')
        new_credentials = {'username': 'user', 'password': 'strong'}
        public_query = 'some.public.query = True'
        User.objects.create_superuser(
            email='user@example.com',
            **new_credentials
        )

        # Login and save two queries
        self.client.login(**self.credentials)
        self.post_query(public_query)
        self.post_query('my.private.query = True')

        # Update first query to make it public
        query = Query.objects.first()
        self.client.post(update_url, data={'id': query.id, 'public': True})
        response = self.client.get(get_url)
        response_json = json.loads(response.content.decode('utf-8'))
        self.assertEqual(len(response_json['results']['user']), 2)
        # We should not see own public query
        self.assertEqual(len(response_json['results']['public']), 0)

        # Login as new user and check query list, we should see public query
        self.client.login(**new_credentials)
        response = self.client.get(get_url)
        response_json = json.loads(response.content.decode('utf-8'))
        self.assertEqual(len(response_json['results']['user']), 0)
        self.assertEqual(len(response_json['results']['public']), 1)
        self.assertIn(
            public_query,
            [x['text'] for x in response_json['results']['public']]
        )

    def test_delete_query_by_id(self):
        url = reverse('admin:core_book_djangoql_remove_query')
        self.client.login(**self.credentials)
        self.post_query("sample1@example.com")
        self.post_query("sample2@example.com")
        self.assertEqual(Query.objects.count(), 2)

        response = self.client.post(url, data={'id': 1})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Query.objects.count(), 1)

    def post_query(self, query):
        post_url = reverse('admin:core_book_djangoql_save_query')
        return self.client.post(post_url, data={'query': query})
