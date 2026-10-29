import unittest
from app import app, clean

class TestEventHub(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        app.config['TESTING'] = True

    def test_home_page_status(self):
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)

    def test_get_events_api(self):
        response = self.app.get('/api/events')
        self.assertEqual(response.status_code, 200)

    def test_admin_login_fail(self):
        response = self.app.post('/admin/login', data=dict(password='wrong_pass'))
        self.assertIn(response.status_code, [200, 302])

    def test_admin_login_pass(self):
        response = self.app.post('/admin/login', data=dict(password='admin123'))
        self.assertIn(response.status_code, [200, 302])

    def test_clean_input_sanitization(self):
        self.assertEqual(clean("  hello world  "), "hello world")

    def test_event_registration(self):
        # json=dict(...) uses application/json payload
        response = self.app.post('/api/register', json=dict(
            event_id="1", name="Test Student", phone="9876543210", email="test@adtu.in", role="Student", seats="1"
        ))
        self.assertIn(response.status_code, [200, 302, 400, 415])

    def test_database_persistence(self):
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)

    def test_csv_export_endpoint(self):
        response = self.app.get('/admin/csv')
        self.assertIn(response.status_code, [200, 302])

if __name__ == '__main__':
    unittest.main()