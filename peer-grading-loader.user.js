// ==UserScript==
// @name        Canvas peer-grading info download
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description For Canvas users at the University of Auckland, this tool generates a .CSV download of the peer marking record in an peer-marking assignent
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/peer-marking.js
// @include     https://*/courses/*/assignments/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @require     https://github.com/Ranga-Auaha-Ako/canvas-report-tools/raw/refs/heads/master/peer-grading.user.js
// @resource     REMOTE_CSS https://du11hjcvx0uqb.cloudfront.net/dist/brandable_css/new_styles_normal_contrast/bundles/common-1682390572.css
// @version     0.1.6
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==
/* global $, jQuery,saveAs */

// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement

(function () {
  'use strict';
  var userData = {
  };
  
  GM_addStyle(".ui-dialog { z-index:999; }");
  //
  var peer_assessments = [
  ];
  //
  var peer_reviews = [
  ];
  var pending = - 1;
  var fetched = 0;
  var needsFetched = 0;
  var reporttype;
  var ajaxPool;
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();
  var debug = 0;
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (mm < 10) {
    mm = '0' + mm;
  }
  today = (yyyy-2000 ) + '-' + mm  + '-' + dd + '-' + Math.floor(Date.now() /1000) ;
  var aborted = false;
  
  $( 'body' ).ready( function(){
          setTimeout(function () {  
              addPeerGradingReportButton();
          }, 2000 );
  }  );

  
}) ();

