// ==UserScript==
// @name        Canvas breadcrumb code loader
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description For Canvas page edit, show the breadcrumb code for teacher to paste in page html
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/breadcrumbLoader.user.js
// @include     https://*/courses/*/pages/*/edit
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://github.com/Ranga-Auaha-Ako/canvas-report-tools/raw/master/breadcrumb.user.js
// @resource     REMOTE_CSS https://du11hjcvx0uqb.cloudfront.net/dist/brandable_css/new_styles_normal_contrast/bundles/common-1682390572.css
// @version     0.1
// @grant        GM_getResourceText
// @grant        GM_addStyle
// ==/UserScript==
/* global $, jQuery, addGetBreadcrumbLink */

// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement

(function () {
  'use strict';
  var modules = [];
  //
  const myCss = GM_getResourceText("REMOTE_CSS");
  GM_addStyle(myCss);

  var pending = - 1;
  var fetched = 0;
  var ajaxPool;
  var courseId;
  var debug = 0;
  var debugN = 1;
  var moduleIndex = -1;
  var breadCrumbCode='';
  var breadCrumbHead=`
  <div id="breadcrumbDiv">
    <div class="breadcrumb" style="margin: 0; padding: 1em; border-width: 1px; border-style: solid; border-color: #dedede; overflow: hidden;">
        <span style="font-size: 10pt;color:#2D3B45;">`;
        //rgba(3, 116, 181, 1)
  var breadCrumbEnd = `
        </span>
    </div>
  </div>`;

  var aborted = false;
  addGetBreadcrumbLink();
}) ();
