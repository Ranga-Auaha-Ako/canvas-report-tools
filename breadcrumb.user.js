// ==UserScript==
// @name        Canvas get breadcrumb code
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description For Canvas page edit, show the breadcrumb code for teacher to paste in page html
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/discusson-download.user.js
// @include     https://*/courses/*/pages/*/edit
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @resource     REMOTE_CSS https://du11hjcvx0uqb.cloudfront.net/dist/brandable_css/new_styles_normal_contrast/bundles/common-1682390572.css
// @version     0.64
// @grant        GM_getResourceText
// @grant        GM_addStyle
// ==/UserScript==
/* global $, jQuery */

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

  function addGetBreadcrumbLink() {


        generateBreadCrumbCode()

    return;
  }

  function abortAll() {
    for (var i = 0; i < ajaxPool.length; i++) {
      ajaxPool[i].abort();
    }
    ajaxPool = [
    ];
  }
  function setupPool() {
    try {
      ajaxPool = [
      ];
      $.ajaxSetup({
        'beforeSend': function (jqXHR) {
          ajaxPool.push(jqXHR);
        },
        'complete': function (jqXHR) {
          var i = ajaxPool.indexOf(jqXHR);
          if (i > - 1) {
            ajaxPool.splice(i, 1);
          }
        }
      });
    } catch (e) {
      throw new Exception('Error configuring AJAX pool');
    }
  }


  function generateBreadCrumbCode(e) { //gets the student list
    pending = 0;
    fetched = 0;

    aborted = false;
    setupPool();
    courseId = getCourseId();

    if (debug) console.log( courseId );
    //var url = '/api/v1/courses/' + courseId + '/discussion_topics/' + discussionId + "/view";
    //progressbar();
    pending = 0;
    var url = '/api/v1/courses/'+ courseId + '/modules?include[]=items&per_page=30';
    getModules( url );

  }

  function nextURL(linkTxt) { //if more than 100 students, gets the URL for the rest of the list
    var url = null;
    if (linkTxt) {
      var links = linkTxt.split(',');
      var nextRegEx = new RegExp('^<(.*)>; rel="next"$');
      for (var i = 0; i < links.length; i++) {
        var matches = nextRegEx.exec(links[i]);
        if (matches) {
          url = matches[1];
        }
      }
    }
    return url;
  }

  function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  }

  function getModules ( url ) { //cycles through student list
    pending = 0;
    fetched = 0;
    //needsFetched = Object.getOwnPropertyNames(userData).length;

    pending++;
    $.getJSON(url, function (adata, status, jqXHR) {
        url = nextURL(jqXHR.getResponseHeader('Link'));

        for ( var i=0; i < adata.length; i++ ){
            modules[ i ] = adata[i];
            // use items to record all item object in a module
            //modules[ i ][ 'items' ] = [];
        } // end for
        if (url) {
            getModules( url );
        } else{
            if (debugN) console.log( modules );
            if (debugN) console.log( "number of modules:", modules.length );
            //moduleIndex = -1;
            //getModuleItems( );
            
            delay(1500).then(() =>{
              genBreadCrumbCode();
              $('#edit_wikipage_title_container').append('<a href="javascript:void(0)" id="breadcrumb" class="btn" style="float:right;clear:both;"> Insert breadcrum code</a><p>&nbsp;</p>');
              $('#breadcrumb').on('click', {
                type: 1
              }, getBreadcrumb);
            });
        }
    } );
  }


  function genBreadCrumbCode(){
    // find what the module of the page in
    //let title = $('#title').val().trim();
    //let titleAr = document.title.split(":");
    //titleAr.pop();
    //let title = titleAr.join(":").trim();
    let title = jQuery('#wikipage-title-input').val().trim();
    let found = -1;
    let pageAt = 0;
    let resultHtml = '';
    let tmpModule;
    let tmpNodes;
    let tmpIconCode;
    if ( title ){
        for ( let i=0; i< modules.length; i++){

            let tmpModule = modules[i];
            //console.log( { tmpModule }, i );
            if ( tmpModule.items.length>0 ){
                for ( let j=0; j< tmpModule.items.length; j++ ){
                    let tmpNode = tmpModule.items[j];
                    if (debug){
                      console.log( tmpNode.title, title );
                    }
                    if ( tmpNode.title.trim() == title ){
                        found = i;
                        pageAt = j;
                        if (debugN){
                            console.log( "Module found", found );
                        }
                        break;
                    }
                }
            }

        }
        if (found>-1){
            tmpModule = modules[ found ];
            tmpNodes = tmpModule.items;
            //add module link
            resultHtml += `
            <a style="max-width: 20%; white-space: nowrap; overflow: hidden; text-decoration: none; position: relative;"
            title="${tmpModule.name}"
            href="https://canvas.auckland.ac.nz/courses/${courseId}/modules/${tmpModule.id}"
            data-api-endpoint="https://canvas.auckland.ac.nz/api/v1/courses/${courseId}/modules/${tmpModule.id}" data-api-returntype="Module">
            <strong>${tmpModule.name}</strong></a> `;
            for (let m=0;m<tmpNodes.length;m++){
                if (m==pageAt){
                    resultHtml +=`
                    &nbsp;&gt; <strong> ${tmpNodes[m].title}</strong> `;
                } else {
                    if ( tmpNodes[m].type!='SubHeader' ) {
                        switch ( tmpNodes[m].type ){
                            case "ExternalTool":
                                tmpIconCode = `<i class="icon-link"></i>`;
                                break;
                            case "Page":
                                tmpIconCode = `<i class="icon-document"></i>`;
                                break;
                            case "Quiz":
                                tmpIconCode = `<i class="icon-quiz"></i>`;
                                break;
                            case "ExternalUrl":
                                tmpIconCode = `<i class="icon-link"></i>`;
                                break;
                            case "File":
                                tmpIconCode = `<i class="icon-paperclip"></i>`;
                                break;
                            case "Discussion":
                                tmpIconCode = `<i class="icon-discussion"></i>`;
                                break;
                            case "Assignment":
                                tmpIconCode = `<i class="icon-assignment"></i>`;
                                break;
                            default:
                                tmpIconCode = '';
                        }
                        resultHtml +=`
                        &nbsp;&gt;

                        <a style="max-width: 20%; white-space: nowrap; overflow: hidden; text-decoration: none; position: relative;"
                        title="${tmpNodes[m].title}"
                        href="${tmpNodes[m].html_url}"
                        data-api-endpoint="${tmpNodes[m].url}"
                        data-api-returntype="${tmpNodes[m].type}">
                        ${tmpIconCode}
                        &nbsp;${tmpNodes[m].title}
                        </a>
                        `;
                    } else {
                        resultHtml +=`
                        &nbsp;&gt; <span class='title locked_title'> ${tmpNodes[m].title}</span> `;
                    }


                }
            }
        }
        resultHtml = breadCrumbHead + resultHtml + breadCrumbEnd;
        breadCrumbCode = resultHtml;
        if (debugN) console.log( {resultHtml} );
    }
  }

  function getCourseId() { //identifies course ID from URL
    var courseId = null;
    if (debug) console.log( "in getCourseId: window.location", window.location.href );
    try {
      var courseRegex = new RegExp('/courses/([0-9]+)');
      var matches = courseRegex.exec(window.location.href);
      if (matches) {
        courseId = matches[1];
      } else {
        throw new Error('Unable to detect Course ID');
      }
    } catch (e) {
      errorHandler(e);
    }
    return courseId;
  }

  function getBreadcrumb(){
    if (debug) console.log( { breadCrumbCode } );
    insertBreadCrumb();
    ///if ($('#breadcrumbCode').length === 0) {
    /*  
        $('body').append('<div id="breadcrumbContainer"><div id="breadcrumbDiv"></div>');
        jQuery( "#breadcrumbDiv" ).html( breadCrumbCode );
        //jQuery( "#breadcrumbCode" ).val( breadCrumbCode );
        jQuery('#breadcrumbContainer').dialog( {
            title: 'Breadcrumb code copied to clipboard',
            width: 600,
            buttons: {
                InsertBreadCrumb: function() {
                    insertBreadCrumb();
                    $('#breadcrumbContainer').dialog('close');
                }
              }
         }
        );
      */
   // }

  }
  function insertBreadCrumb(){
    let tmpContent = tinyMCE.activeEditor.getContent();

    //console.log( $t.find( "#breadcrumbContainer" ) );
    if (tmpContent.indexOf('<div id="breadcrumbDiv"')>-1 ){
      if (debug) console.log('previous breadcrumb exist');
      let selection = tinyMCE.activeEditor.dom.select('div[id="breadcrumbDiv"]')[0];

    // If selection exists, select node and replace it
       if (selection) {
          tinyMCE.activeEditor.selection.select(selection);
          tinymce.activeEditor.selection.setContent(breadCrumbCode);
       } else{
          tinyMCE.activeEditor.setContent(  breadCrumbCode + tmpContent);
       }

    } else  {
      //if has include CourseHeader
      if (tmpContent.indexOf('class="CourseHeader"')>-1 ){
        //add breadcrumb at the cursor
        //tinymce.activeEditor.selection.setContent(tinymce.activeEditor.dom.createHTML('div', {}, breadCrumbCode));
        let tmpHeader = tinyMCE.activeEditor.dom.select('.CourseHeader')[0];

        let brElement = tinymce.activeEditor.dom.create('p', {id:"headerBr"}, '');
        let breadCrumbContainer = tinymce.activeEditor.dom.create('div', {}, breadCrumbCode );
        tinyMCE.activeEditor.dom.insertAfter( brElement, tmpHeader);
        tinyMCE.activeEditor.dom.insertAfter( breadCrumbContainer, brElement );
      } else {
        if ( tinyMCE.activeEditor.dom.select('header') ){
          //add breadcrumb at the cursor
          //tinymce.activeEditor.selection.setContent(tinymce.activeEditor.dom.createHTML('div', {}, breadCrumbCode));
          try{
            let tmpHeader = tinyMCE.activeEditor.dom.select('header')[0];
            let tmpHeaderParent = tinyMCE.activeEditor.dom.getParent( tmpHeader, 'div' );
            console.log( { tmpHeaderParent } );
            let brElement = tinymce.activeEditor.dom.create('p', {id:"headerBr"}, '');
            let breadCrumbContainer = tinymce.activeEditor.dom.create('div', {}, breadCrumbCode );
            tinyMCE.activeEditor.dom.insertAfter( brElement, tmpHeaderParent);
            tinyMCE.activeEditor.dom.insertAfter( breadCrumbContainer, brElement );
          } catch(e){
            tinyMCE.activeEditor.setContent(  breadCrumbCode + tmpContent);
          }

        } else {
          tinyMCE.activeEditor.setContent(  breadCrumbCode + tmpContent);
        }

      }

    }

    //tinyMCE.execCommand('mceInsertContent', false, breadCrumbCode);
  }
  function copyClipboard() {
    jQuery('#breadcrumbCode').focus();
    jQuery('#breadcrumbCode').select();
    document.execCommand('copy');
    alert("html code copied to clipboard, switch to Raw H");
  }


  function errorHandler(e) {
    console.log(e.name + ': ' + e.message);
  }
}) ();
