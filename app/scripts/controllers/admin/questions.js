'use strict';

/**
 * @ngdoc function
 * @name sqlexplorerFrontendApp.controller:AdminQuestionsCtrl
 * @description
 * # AdminQuestionsCtrl
 * Controller of the sqlexplorerFrontendApp
 */
angular.module('sqlexplorerFrontendApp')
  .controller('AdminQuestionsCtrl', function ($scope, $http, BASE_URL, $routeParams, $window) {
      $http({
        url: BASE_URL + '/api/tags',
        method: 'GET',
        withCredentials: true
      })
      .success(function(tags){
        $scope.tags = tags;
      })
      
      $http.get(BASE_URL + '/api/db/list')
      .success(function(dbs){
        dbs.unshift({OWNER: 'ALL'});
        $scope.dbs = dbs;
      });
      
      function updateAssignmentList(){
          $http.get(BASE_URL + '/api/assignment/list', {withCredentials: true})
          .success(function(assignments){
            $scope.assignments = assignments;
          });
      }
      updateAssignmentList();
      
      $scope.dbname = 'ALL';
      if($routeParams.db){
        $scope.dbname = $routeParams.db;
      }
      
      
      $scope.selectedKeywords = [];
      $scope.keywordInclusive = 0;
      $scope.isKeywordSelected = function(keyword){
        return $scope.selectedKeywords.indexOf(keyword) >= 0;
      }

      $scope.toggleKeyword = function(keyword){
        if($scope.isKeywordSelected(keyword)){
          $scope.selectedKeywords.splice( $scope.selectedKeywords.indexOf(keyword), 1);
        }else{
          $scope.selectedKeywords.push(keyword);
        }
      };
      
      $scope.createNewAssignment = function(){
        var name = $window.prompt('Name');
        if(!name) return;
        var year =  $window.prompt('Year');
        if(!year) return;
        var course = $window.prompt('Course');
        if(!course) return;
        $http.post(BASE_URL + '/api/assignment', {name: name, year: year, course: course}, {cache: false, withCredentials: true})
        .success(function(res){
          updateAssignmentList();
          $scope.assignmentId = res.id;
        });
      };
      
      $scope.addQuestionToAssignment = function(questionId){
        $http.post(BASE_URL + '/api/assignment/' + $scope.assignmentId + '/question', {questionId: questionId}, {cache: false, withCredentials: true})
        .success(function(){
          updateAssignmentList();
        });
      };

      $scope.$watch('[selectedKeywords, keywordInclusive, dbname]', function(){
        $http.post(BASE_URL + '/api/questions', {keywords: $scope.selectedKeywords, inclusive: $scope.keywordInclusive, dbname: $scope.dbname}, {cache: false, withCredentials: true})
        .success(function(questions){
          $scope.questions = questions;
        });
      }, true);
  });
