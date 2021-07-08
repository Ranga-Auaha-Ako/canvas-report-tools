// ==UserScript==
// @name        Canvas get breadcrumb code
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description For Canvas page edit, show the breadcrumb code for teacher to paste in page html
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/discusson-download.user.js
// @include     https://*/courses/*/pages/*/edit
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @version     0.4
// @grant       none
// ==/UserScript==

// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement

(function () {
  'use strict';
  var modules = [];
  //

  
  var pending = - 1;
  var fetched = 0;
  var ajaxPool;
  var courseId;
  var debug = 0;
  var moduleIndex = -1;
  var breadCrumbCode=''; 
  var breadCrumbHead=`
  <div id="breadcrumbDiv" style="clear:both">
    <div class="breadcrumb" style="margin: 0 2em 1em 0; padding: 1em; background: #eee; border-width: 1px; border-style: solid; border-color: #f5f5f5 #e5e5e5 #ccc; overflow: hidden;">
        <span style="font-size: 10pt;">`;
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
    var url = '/api/v1/courses/'+ courseId + '/modules?per_page=30';
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
            modules[ i ][ 'items' ] = [];
        } // end for
        if (url) {
            getModules( url );
        }
        pending--;
        if (pending <= 0) {
            if (debug) console.log( modules );
            if (debug) console.log( "number of modules:", modules.length );
            getModuleItems( );

        }
    } );
  }

  function getModuleItems() { //cycles through module list
    let items_url;
    pending = 0;
    fetched = 0;

    moduleIndex +=1;
    if ( moduleIndex < modules.length ) {
        items_url = modules[moduleIndex]["items_url"];
        if ( items_url!="" ) {
            getItems(items_url);
        } else{
            getModuleItems();
        }
        
    } else{
        //print out result 
        if (debug) console.log( modules );
        //prepare the breadcrumb code
        genBreadCrumbCode();
        if ($('#breadcrumb').length === 0) {
          $('#title').after('<a href="javascript:void(0)" id="breadcrumb" class="btn" style="float:right;clear:both;"> Get breadcrum code</a>');
          $('#breadcrumb').on('click', {
            type: 1
          }, getBreadcrumb);
        }
    }
  
  }

  function genBreadCrumbCode(){
    // find what the module of the page in
    let title = $('#title').val().trim();
    let found = -1;
    let pageAt = 0;
    let resultHtml = '';
    let tmpModule;
    let tmpNodes;
    let tmpIconCode;
    if ( title ){
        for ( let i=0; i< modules.length; i++){
            let tmpModule = modules[i];
            if ( tmpModule.items.length>0 ){
                for ( let j=0; j< tmpModule.items.length; j++ ){
                    let tmpNode = tmpModule.items[j];
                    if ( tmpNode.title.trim() == title ){
                        found = i;
                        pageAt = j;
                        if (debug){
                            console.log( "Module found" );
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
        if (debug) console.log( resultHtml );
    }
  }

  function getItems(items_url) { //get peer review data
    
    let tmpItem;
    let url;
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      pending++;
      if (debug) console.log( "get module item:", items_url  )
      
      $.getJSON(items_url, function (adata, status, jqXHR) {
        //get participants:  id, display_name
        for ( var i=0; i < adata.length; i++ ) {
          tmpItem = adata[i];
          modules[ moduleIndex ]['items'].push( adata[i] );
        }
        
        //get views: userid, message 
               
        url = nextURL(jqXHR.getResponseHeader('Link'));
        
        if (url) {
          getItems( url );
        }
        pending--;
        
        if (debug) console.log( "pending:", pending  );
        if (pending <= 0 && !aborted) {
          // get next module
          getModuleItems()
        }
      }).fail(function () {
        pending--;
        getModuleItems()
        if (!aborted) {
          console.log('Some report data failed to load');
        }
      });
    } catch (e) {
      errorHandler(e);
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
    ///if ($('#breadcrumbCode').length === 0) {
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
      tinyMCE.activeEditor.setContent(  breadCrumbCode + tmpContent);
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

