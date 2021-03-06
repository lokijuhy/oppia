# Copyright 2018 The Oppia Authors. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Request handler for exporting backups.

Please see original reference here:

https://cloud.google.com/datastore/docs/schedule-export

"""

import datetime
import httplib
import json
import logging

from oppia.export import acl_decorators

from google.appengine.api import app_identity
from google.appengine.api import urlfetch
import webapp2


class ExportToCloudDatastoreHandler(webapp2.RequestHandler):

    @acl_decorators.can_perform_cron_tasks
    def get(self):
        GCS_BUCKET_URL_PREFIX = 'gs://'

        access_token, _ = app_identity.get_access_token(
            'https://www.googleapis.com/auth/datastore')
        app_id = app_identity.get_application_id()
        timestamp = datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S')

        output_url_prefix = self.request.get('output_url_prefix')
        assert output_url_prefix and output_url_prefix.startswith(
            GCS_BUCKET_URL_PREFIX)

        # Look for slash in the portion of the bucket URL that comes
        # after 'gs://'. If not present, then only a bucket name has been
        # provided and we append a trailing slash.
        if '/' not in output_url_prefix[len(GCS_BUCKET_URL_PREFIX):]:
             # Only a bucket name has been provided - no prefix or trailing
             # slash.
            output_url_prefix += '/' + timestamp
        else:
            output_url_prefix += timestamp

        entity_filter = {
            'kinds': self.request.get_all('kind'),
            'namespace_ids': self.request.get_all('namespace_id')
        }
        request = {
            'project_id': app_id,
            'output_url_prefix': output_url_prefix,
            'entity_filter': entity_filter
        }
        headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer %s' % access_token
        }
        url = 'https://datastore.googleapis.com/v1/projects/%s:export' % app_id
        try:
            result = urlfetch.fetch(
                url=url,
                payload=json.dumps(request),
                method=urlfetch.POST,
                deadline=60,
                headers=headers)
            if result.status_code == httplib.OK:
                logging.info(result.content)
            elif result.status_code >= 500:
                logging.error(result.content)
            else:
                logging.warning(result.content)
            self.response.status_int = result.status_code
        except urlfetch.Error:
            logging.exception('Failed to initiate export.')
            self.response.status_int = httplib.INTERNAL_SERVER_ERROR


app = webapp2.WSGIApplication(
    [
        ('/cloud_datastore_export', ExportToCloudDatastoreHandler),
    ], debug=True)
