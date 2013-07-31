// Copyright 2012 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Controllers for the reader's view of an exploration.
 *
 * @author sll@google.com (Sean Lip)
 */

 function ReaderExploration($scope, $http, $timeout, warningsData) {
  // The pathname is expected to be: /[exploration_id]
  $scope.explorationId = pathnameArray[2];
  $scope.explorationDataUrl = '/learn/' + $scope.explorationId + '/data';

  $scope.urlParams = $scope.getUrlParams();
  $scope.iframed = ($scope.urlParams.hasOwnProperty('iframed') &&
      $scope.urlParams['iframed']);

  // Initializes the story page using data from the server.
  $scope.initializePage = function() {
    $http.get($scope.explorationDataUrl)
        .success(function(data) {
          $scope.explorationTitle = data.title;
          $scope.loadPage(data);
          window.scrollTo(0, 0);
        }).error(function(data) {
          warningsData.addWarning(
              data.error || 'There was an error loading the exploration.');
        });
    $scope.responseLog = [];
  };

  $scope.initializePage();

  $scope.answerIsBeingProcessed = false;

  $scope.loadPage = function(data) {
    $scope.blockNumber = data.block_number;
    $scope.categories = data.categories;
    $scope.finished = data.finished;
    $scope.inputTemplate = data.interactive_html;
    $scope.responseLog = [data.oppia_html];
    $scope.params = data.params;
    $scope.stateId = data.state_id;
    $scope.title = data.title;
    $scope.iframeOutput = data.iframe_output;
    $scope.stateHistory = data.state_history;
    // We need to generate the HTML (with the iframe) before populating it.
    $scope.addContentToIframeWithId('inputTemplate', $scope.inputTemplate);

    // TODO(sll): Try and get rid of the "$digest already in progress" error here.
    // The call to $apply() is needed before updateMath() is called.
    $scope.$apply();
    $scope.updateMath();

    for (var i = 0; i < $scope.iframeOutput.length; i++) {
      $scope.addContentToIframeWithId(
        'widgetCompiled' + $scope.iframeOutput[i].blockIndex +
            '-' + $scope.iframeOutput[i].index,
        $scope.iframeOutput[i].raw);
    }
  };

  $scope.submitAnswer = function(answer, handler) {
    if ($scope.answerIsBeingProcessed) {
      return;
    }

    var requestMap = {
      answer: answer,
      block_number: $scope.blockNumber,
      handler: handler,
      params: $scope.params,
      state_history: $scope.stateHistory
    };

    $scope.answerIsBeingProcessed = true;

    $http.post(
        '/learn/' + $scope.explorationId + '/' + $scope.stateId,
        $scope.createRequest(requestMap),
        {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
    ).success($scope.refreshPage)
    .error(function(data) {
      $scope.answerIsBeingProcessed = false;
      warningsData.addWarning(
        data.error || 'There was an error processing your input.');
    });
  };

  $scope.refreshPage = function(data) {
    $scope.answerIsBeingProcessed = false;

    $scope.blockNumber = data.block_number;
    $scope.categories = data.categories;
    $scope.inputTemplate = data.interactive_html;
    $scope.stateId = data.state_id;
    $scope.finished = data.finished;

    $scope.params = data.params;
    $scope.stateHistory = data.state_history;

    $scope.responseLog = $scope.responseLog || [];
    $scope.responseLog.push(data.reader_response_html, data.oppia_html);

    for (var i = 0; i < data.iframe_output.length; i++) {
      $scope.iframeOutput.push(data.iframe_output[i]);
    }

    // We need to generate the HTML (with the iframe) before populating it.
    if ($scope.inputTemplate) {
      // A non-empty interactive_html means that the previous widget
      // is not sticky and should be replaced.
      $scope.addContentToIframeWithId('inputTemplate', $scope.inputTemplate);
    } else if ($scope.finished) {
      $scope.addContentToIframeWithId('inputTemplate', '');
    }

    // TODO(sll): Try and get rid of the "$digest already in progress" error here.
    // The call to $apply() is needed before updateMath() is called.
    $scope.$apply();
    $scope.updateMath();

    // TODO(sll): Can this be done without forcing a reload of all the existing iframes?
    for (var i = 0; i < $scope.iframeOutput.length; i++) {
      $scope.addContentToIframeWithId(
        'widgetCompiled' + $scope.iframeOutput[i].blockIndex +
            '-' + $scope.iframeOutput[i].index,
        $scope.iframeOutput[i].raw);
    }

    if (data.reader_response_iframe) {
      // The previous user response needs to be rendered in a custom html with
      // an iframe.
      var iframes = document.getElementsByClassName('logContent');
      if (iframes.length) {
        $scope.addContentToIframe(
            iframes[iframes.length - 1], data.reader_response_iframe);
      }
    }

    var currentScrollTop = $('body').scrollTop();
    // TODO(sll): This should actually scroll to the location of last element in
    // response log.
    $('html,body').animate({scrollTop: Math.max(
        $(document).height() - 1000, currentScrollTop + 50)});
  };

  window.addEventListener('message', receiveMessage, false);

  function receiveMessage(evt) {
    console.log('Event received.');
    console.log(evt.data);
    if (evt.origin == window.location.protocol + '//' + window.location.host) {
      $scope.submitAnswer(JSON.parse(evt.data)['submit'], 'submit');
    }
  }
}

/**
 * Injects dependencies in a way that is preserved by minification.
 */
ReaderExploration.$inject = ['$scope', '$http', '$timeout', 'warningsData'];
