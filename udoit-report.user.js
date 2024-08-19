// ==UserScript==
// @name        UDOIT reports download
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description Grab udoit admin data from all semesters and generates a .CSV download 
// @include     https://*.ciditools.com/admin*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/xlsx.full.min.js
// @require     https://github.com/Ranga-Auaha-Ako/canvas-report-tools/raw/master/udoit-report-flex.user.js
// @resource    REMOTE_CSS https://du11hjcvx0uqb.cloudfront.net/dist/brandable_css/new_styles_normal_contrast/bundles/common-1682390572.css
// @version     0.6
// @grant       GM_getResourceText
// @grant       GM_addStyle
// ==/UserScript==
/* global $, jQuery,XLSX,saveAs */

// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement

(function () {
  'use strict';

  const myCss = GM_getResourceText("REMOTE_CSS");
  GM_addStyle(myCss);
  
  // to combine 2022, 2023: term id: 234, 231, 230, 243, 241

  var terms = {
    "243": "2023 Semester One",
    "242": "2023 Academic Year Term",
    "241": "2023 Quarter One",  
    "234": "2022 Semester Two",
    "244": "2023 Quarter Two",
    "240": "2023 Summer School",
    "245": "2023 Semester Two",
    "231": "2022 Semester One",
    "230": "2022 Summer School",
    "247": "2023 Quarter Four",
    "246": "2023 Quarter Three",
    "250": "2024 Summer School",
    "228": "2022 Academic Year Term",
    "248": "2023 Doctoral Academic Year",
    "251": "2024 Quarter One",
    "252": "2024 Quarter Two",
    "235": "2022 Quarter Three",
    "253": "2024 Quarter Three",
    "355": "2024 Semester One",
    "356": "2024 Semester Two",
    "357": "2024 Academic Year Term",
} ;
  //var termsAr = [ "230", "231", "234", "241", "243" ];
  //var termsAr = [ "1","71","106", "108","111", "217", "218", "222", "228", "230", "231", "234","235","240", "241", "243","244", "245","246","247","248","250","251" ]; // make it shorter, just for quicker test purpose
  //var termsAr = [ "1", "230", "231", "234","235","240", "241", "243","244", "245","246","247","248","250","251", "252", "253", "355", "356", "357" ]; // make it shorter, just for quicker test purpose
  var termsAr = [ "250","251", "252", "253", "355", "356", "357" ];
  
  var termIndex = -1;
  var tokenId = getToken();
  //global array to collect reports, issues, file_issues, actions
  var reportsAr = [];
  var issuesAr = [];
  var file_issuesAr = [];
  var actionsAr = [];
  var coursesAr = [];
  //https://apac.udoit3.ciditools.com/api/admin/courses/account/1/term/253?subaccounts=true
  var urlAr = [ 
  'https://apac.udoit3.ciditools.com/api/admin/reports/account/1/term/{termId}?subaccounts=true',
  'https://apac.udoit3.ciditools.com/api/admin/issues/account/1/term/{termId}?subaccounts=true',
  'https://apac.udoit3.ciditools.com/api/admin/file_issues/account/1/term/{termId}?subaccounts=true',
  'https://apac.udoit3.ciditools.com/api/admin/file_actions/account/1/term/{termId}?subaccounts=true',
  'https://apac.udoit3.ciditools.com/api/admin/courses/account/1/term/{termId}?subaccounts=true' 
 ];

 var faculties = {
  "Arts":"Arts",
  "Humanities":"Arts",
  "Social Sciences":"Arts",
  "Cultures, Languages and Linguistics":"Arts",
  "Humanities":"Arts",
  "Applied Language Studies and Linguistics":"Arts",
  "Māori and Pacific Studies":"Arts",
  "Accounting and Finance":"Business and Economics",
  "Architecture and Planning":"Creative Arts and Industries",
  "Biological Sciences":"Science",
  "Business and Economics":"Business and Economics",
  "Chemical and Materials Engineering":"Engineering",
  "Chemical Sciences":"Science",
  "Civil and Environmental Engineering":"Engineering",
  "Commercial Law":"Business and Economics",
  "Computer Science":"Science",
  "Counselling, Human Services and Social Work":"Arts",
  "Critical Studies in Education":"Education",
  "Curriculum and Pedagogy":"Education",
  "Dance Studies Programme":"Creative Arts and Industries",
  "Economics":"Business and Economics",
  "Creative Arts & Industries":"Creative Arts and Industries",
  "Education and Social Work":"Education",
  "Electrical and Computer Engineering":"Engineering",
  "Engineering":"Engineering",
  "Engineering Science":"Engineering",
  "Environment":"Science",
  "Exercise Sciences":"Science",
  "Faculty Administration Education":"Education",
  "Faculty Administration Medical and Health Sciences":"FMHS",
  "Fine Arts":"Creative Arts and Industries",
  "Graduate School of Management":"Business and Economics",
  "Information Systems and Operations Management":"Business and Economics",
  "Law":"Law",
  "Learning Development and Professional Practice":"Education",
  "Management and International Business":"Business and Economics",
  "Marine Science":"Science",
  "Marketing":"Business and Economics",
  "Mathematics":"Science",
  "Mechanical Engineering":"Engineering",
  "Medical Sciences":"FMHS",
  "Medicine":"FMHS",
  "Music":"Creative Arts and Industries",
  "Nursing":"FMHS",
  "Pharmacy":"FMHS",
  "Physics":"Science",
  "Population Health":"FMHS",
  "Property":"Business and Economics",
  "Psychology":"Science",
  "Science":"Science",
  "Social Sciences":"Arts",
  "Statistics":"Science",
  "Te Kupenga Hauora Maori":"FMHS",
  "Te Puna Wananga":"Education"};
  
  //
  
  
  var pending = - 1;
  var fetched = 0;
  var needsFetched = 0;
  var ajaxPool;
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();

  var debug = 1;
  var debugDate = 0;
  var debugReport = 0;
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (mm < 10) {
    mm = '0' + mm;
  }
  //courseId = getCourseId();
 // quizId = getQuizId(); 

  today = (yyyy-2000 ) + '-' + mm  + '-' + dd + '-' + Math.floor(Date.now() /1000) ;
  var aborted = false;
  $( document ).ready( function(){addDownloadReportButton();}  );

}) ();

