'use strict';

/**
 * @ngdoc function
 * @name sqlexplorerFrontendApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the sqlexplorerFrontendApp
 */

//We already have a limitTo filter built-in to angular,
//let's make a startFrom filter
angular.module('sqlexplorerFrontendApp')
.filter('startFrom', function() {
    return function(input, start) {
        if(input && input.length){
            start = +start; //parse to int
            return input.slice(start);
        }else{
            return input;
        }
    };
});

function removeNL(s) {
  /*
  ** Remove NewLine, CarriageReturn and Tab characters from a String
  **   s  string to be processed
  ** returns new string
  */
  var r = '';
  for (var i=0; i < s.length; i++) {
    if (s.charAt(i) !== '\n' &&
        s.charAt(i) !== '\r' &&
        s.charAt(i) !== '\t') {
      r += s.charAt(i);
      }
    }
  return r;
}

angular.module('sqlexplorerFrontendApp')
.controller('MainCtrl', function ($scope, $http, $routeParams, $location, $window, $q,
             $timeout, localStorageService, admin, BASE_URL) {

    $scope.history = [];
    $scope.historyLimit = true;
    $scope.currentPage = 0;
    $scope.pageSize = 10;
    $scope.numberOfPages = function(){
        return $scope.results && $scope.results.content && Math.ceil($scope.results.content.length/$scope.pageSize) || 0;
    };

    $scope.editorOptions = {
    lineNumbers: true,
    mode:  'text/x-oracle',
    theme: 'neat',
    matchBrackets: true,
    extraKeys: {
      'Ctrl-Enter': function(){
        $scope.evaluate();
            }
        }
    };

    $scope.admin = admin;
    if($routeParams.db){
        $scope.db = $routeParams.db.toUpperCase();
        //todo as watch?
        $scope.history = localStorageService.get($scope.db) || [];
    }
    var search = $window.location.search.split('=');
    //from scorm frame
    if(search.length > 1){
        if(isNaN(search[1])){
          $scope.db = search[1].toUpperCase();
          //todo as watch?
          $scope.history = localStorageService.get($scope.db) || [];
        }else{
          $routeParams.id = search[1];
        }
        var start = new Date().getTime();
        var checkScormAPI = function (){
          if(scorm_api){
            if(scorm_score > 0){
              //question passed
              $scope.passed = true;
            }
          } else if(new Date().getTime() - start < 3000){
            $timeout(checkScormAPI, 200);
          }else{
            alert('no scorm api connection!');
          }
        };
        checkScormAPI();
    }

    if($routeParams.id){
        $scope.questionId = $routeParams.id;
        //IF admin get answer
        var url = '/api/questiontext/';
        var options = {};
        if($scope.admin){
            url = '/api/question/';
            options['withCredentials'] = true;
        }
        $http.get(BASE_URL + url + $scope.questionId, options)
        .success(function(question){
            $scope.db = question.db_schema.toUpperCase();
            //todo as watch?
            $scope.history = localStorageService.get($scope.db) || [];
            $scope.question = question;
        })
        .error(function(err){
            //TODO: handle failure
            console.log(err);
        });
    }

  $scope.question = {
    sql: ''
  };

  $scope.format = function(){
    $http.post('https://amc.ig.he-arc.ch/sqlformat/api/v1/format', {
      sql: $scope.question.sql,
      reindent: 1,
      keyword_case: 'upper'
    },{
      headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
      transformRequest: function(obj) {
          var str = [];
          for(var p in obj) {
      str.push(encodeURIComponent(p) + '=' + encodeURIComponent(obj[p]));
    }
          return str.join('&');
      }
    })
    .success(function(data){
        $scope.question.sql = data.result;
    });
  };

    $scope.evaluate = function(){
        var timeout = $q.defer(),
            timedOut = false;

        $scope.results = [];
        $scope.error = '';
        $scope.evaluating = true;

        $timeout(function(){
          timedOut = true;
          timeout.resolve();
        }, 10000);

        var data = {sql:$scope.question.sql, db:$scope.db};
        if($scope.questionId){
            data.id = $scope.questionId;
        }
        if(scorm_api){
          data.user_id = doLMSGetValue('cmi.core.student_id');
          data.user_name = doLMSGetValue('cmi.core.student_name');
        }

        $http.post(BASE_URL + '/api/evaluate', data, {cache: false, timeout: timeout.promise})
        .success(function(data){
            var history = {sql: $scope.question.sql};
            $scope.results = data;
            $scope.currentPage = 0;
            if(data.error){
                $scope.error = data.error;
                history.error = data.error;
            }
            if(data.hasOwnProperty('numrows')){
                history.result = data.numrows;
            }
            if(scorm_api){
              //save interaction only has a range from 0-255
              // cmi suff is broken in moodle >2.8
              //doLMSSetValue('cmi.interactions.'+ 0 +'.student_response', removeNL(history.sql).substring(0,255));
              //doLMSSetValue('cmi.interactions.'+ 0 +'.result', data.correct ? 'correct' : 'wrong');
              if(data.correct){
                  doLMSSetValue('cmi.core.score.raw', 1);
                  doLMSSetValue('cmi.core.lesson_status','passed');
                  //questionPassed
                  $scope.passed = {sql: history.sql, answer: data.answer};
              }else{
                  doLMSSetValue('cmi.core.score.raw', 0);
                  doLMSSetValue('cmi.core.lesson_status','failed');
              }
            }


            $scope.evaluating = false;

            $scope.history.unshift(history);

            //could be moved to watch
            localStorageService.set($scope.db, $scope.history);

        })
        .error(function(data){
          if (timedOut) {
            $scope.evaluating = false;
            $scope.error = 'unable to contact server';
          }else{
            $scope.evaluating = false;
            $scope.error = data;
          }
        });
    };

  $scope.upsert = function(){
    var question = {sql:$scope.question.sql, text:$scope.question.text, db_schema: $scope.db};
    if($scope.question.id){
      question.id = $scope.question.id;
    }
    $http.post(BASE_URL + '/api/question', question, {cache: false, withCredentials: true})
        .success(function(data){
          $scope.evaluating = false;
          $location.search('id', data.id);
        })
    .error(function(data){
      $scope.evaluating = false;
    });

  };

  $scope.navToNewQuestion = function(){
    $location.search('id', undefined);
  };

  $scope.isNum = function(a){
    return !isNaN(a);
  };

  $scope.isNull = function(a){
    return a === '(NULL)';
  };

  $scope.clearHistory = function(){
    localStorageService.remove($scope.db);
    $scope.history = [];
  };

});
