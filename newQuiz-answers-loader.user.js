// ==UserScript==
// @name        Canvas new quizzes student answers download
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description Canvas new quizzes student answers download
// @match      https://auckland.quiz-lti-syd-prod.instructure.com/lti/launch
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/xlsx.full.min.js
// @require     https://github.com/Ranga-Auaha-Ako/canvas-report-tools/raw/refs/heads/master/new-quiz-answers-download.user.js
// @resource     REMOTE_CSS https://du11hjcvx0uqb.cloudfront.net/dist/brandable_css/new_styles_normal_contrast/bundles/common-1682390572.css
// @version     0.1
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==
/* global $, jQuery,XLSX,saveAs,addDownloadReportButton */

// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement

(function () {
    'use strict';
    
    const myCss = GM_getResourceText("REMOTE_CSS");
    GM_addStyle(myCss);
  

    var users = [];
    var userNameList = {};
    var totalStudents = 0;
    var sessionFetched = 0;
    
    var tokenId = "";
    var launch_url = "";
    var assignmentId="";
    //global array to collect reports
    var reportsAr = {};
    var totalReportAr = {};
    var quizItems = {};
    var studentsAnswers = {};
    var choiceItems = {};
    var maxAttempt = 1;
    //store all attempt sessions and userId
    var sessionList = [];
     
    var pending = -1;
    var fetched = 0;
    var needsFetched = 0;
    var ajaxPool;
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth() + 1;
    var yyyy = today.getFullYear();
    //getToken();
    var pageId = 1;
    var debug = 0;
    var debugReport = 0;
    var titleAr = [];
    if (dd < 10) {
      dd = '0' + dd;
    }
    if (mm < 10) {
      mm = '0' + mm;
    }
  
    var linkPattern = `https://auckland.quiz-lti-syd-prod.instructure.com/api/assignments/${assignmentId}/participants?page=${pageId}`;
    //courseId = getCourseId();
   // quizId = getQuizId();
    //getBatches()
    today = (yyyy-2000 ) + '-' + mm + '-' + dd + '-' + Math.floor(Date.now() /1000) ;
    var aborted = false;
    $( 'body' ).ready( function(){
          setTimeout(function () {  
              addDownloadReportButton();
          }, 5000 );
      }  );

}) ();

