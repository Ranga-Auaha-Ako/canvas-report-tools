// ==UserScript==
// @name        Canvas assignment bulk upload script
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description Canvas assignment bulk upload script
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/assignment-bulk-upload.user.js
// @include     https://*/courses/*/assignments/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @require     https://unpkg.com/xlsx/dist/xlsx.full.min.js
// @require     https://raw.githubusercontent.com/gildas-lormeau/zip.js/master/dist/zip-fs-full.min.js
// @require     https://github.com/Ranga-Auaha-Ako/canvas-report-tools/raw/refs/heads/master/assignment-bulk-upload.user.js
// @version     0.4
// @grant       none
// ==/UserScript==
// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement
(function() {
  'use strict';
  // Change studentRegex for international support

  var studentRegex = new RegExp('^([0-9]+) student');
  var pending = -1;
  var fetched = 0;
  var needsFetched = 0;
  var ajaxPool;
  var userData = {};
  var userDataUserId = {};
  var studentIdArray = [];
  var userIdArray = [];
  var fileEntries = [];
  var fileNameArray=[];
  var courseId;
  var assignmentId;
  var sections = {};
  var debug = 0;
  var debugCheckStudents = 0;
  var submissionAr = [];
  var aborted = false;
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();
  var uploadType = -1;
  var targetI = 1;
  var doing = 0;
  var useUserId = 0;
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (mm < 10) {
    mm = '0' + mm;
  }
  var excelExist = 0;
  var zipExist = 0;
  var studentsFromExcel;
  //courseId = getCourseId();
 // quizId = getQuizId(); 

  today = (yyyy-2000 ) + '-' + mm  + '-' + dd + '-' + Math.floor(Date.now() /1000) ;
  addSubmissionUploadButton();

  }) ();
