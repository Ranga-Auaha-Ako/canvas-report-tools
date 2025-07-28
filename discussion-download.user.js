// ==UserScript==
// @name        Canvas discussion topic information download
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description For Canvas users, this tool generates a .CSV download of the quiz submissions information
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/discusson-download.user.js
// @include     https://*/courses/*/discussion_topics/*
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/jszip.min.js
// @version     0.2
// @grant       none
// ==/UserScript==

// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement

(function () {
  'use strict';
  var participants = {};
  //

  //
  var discussionPosts = [
  ]; // quiz_submissions is array of objects
  var pending = - 1;
  var fetched = 0;
  var needsFetched = 0;
  var reporttype;
  var ajaxPool;
  var courseId;
  var discussionId;
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();
  var zip = new JSZip();
  var debug = 0;
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (mm < 10) {
    mm = '0' + mm;
  }
 
  today = (yyyy-2000 ) + '-' + mm  + '-' + dd + '-' + Math.floor(Date.now() /1000) ;
  var aborted = false;
  $( document ).ready( 
    setTimeout( addDiscussionDownloadButton, 5000)

    //function(){ addDiscussionDownloadButton(); } 
  );

  function addDiscussionDownloadButton() {

        if ($('#discusson-topic-download').length === 0) {
         jQuery('#discussion-redesign-layout').before('<a href="javascript:void(0)" id="discusson-topic-download" class="btn"><i class="icon-download"></i> Download discussions</a>');
          $('#discusson-topic-download').one('click', {
            type: 2
          }, discussionSubmissionReport);
        }


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

  function discussionSubmissionReport(e) { //gets the student list
    pending = 0;
    fetched = 0;
    reporttype = e.data.type;
    aborted = false;
    setupPool();
    courseId = getCourseId();
    discussionId = getdiscussionId();
    if (debug) console.log( courseId, discussionId );
    //var url = '/api/v1/courses/' + courseId + '/discussion_topics/' + discussionId + "/view";
    //progressbar();
    pending = 0;
    getDiscussionSubmissions( courseId, discussionId );

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

  
  function getDiscussionSubmissions( courseId, discussionId ) { //cycles through student list
    pending = 0;
    fetched = 0;
    //needsFetched = Object.getOwnPropertyNames(userData).length;
    if (debug) console.log( "getDiscussionSubmissions:" );
    var url = '/api/v1/courses/'+ courseId + '/discussion_topics/' + discussionId + '/view?per_page=50';
    getDiscussionPosts( url, courseId, discussionId );
  }


  function getDiscussionPosts( url, courseId, discussionId ) { //get peer review data
    var tmpQuizSubmissions;
    var tmpStudent;
    var tmpUrl;
    if (debug) console.log( "in getDiscussionPosts:" );

    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      jQuery("#doing").html( "Fetching Discission Post information <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
      pending++;
      progressbar(fetched, needsFetched);
      $.getJSON(url, function (adata, status, jqXHR) {
        //get participants:  id, display_name
        for ( var i=0; i < adata["participants"].length; i++ ) {
          tmpStudent = adata["participants"][i];
          participants[ tmpStudent.id ] = tmpStudent;
        }
        
        //get views: userid, message
        discussionPosts.push.apply(discussionPosts, adata["view"]);
        
        url = nextURL(jqXHR.getResponseHeader('Link'));
        
        if (url) {
          getDiscussionPosts( url, courseId, discussionId );
        }
        pending--;
        fetched+=50;
        progressbar(fetched, needsFetched);
        
        if (debug) console.log( "pending:", pending  );
        if (pending <= 0 && !aborted) {
          makeReport( courseId, discussionId );
        }
      }).fail(function () {
        pending--;
        fetched+=50;
        progressbar(fetched, needsFetched);
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

  function getdiscussionId() { //identifies quiz ID from URL
    var discussionId = null;
    if (debug) console.log( "in getdiscussionId: window.location", window.location.href );

    try {
      var quizRegex = new RegExp('/discussion_topics/([0-9]+)');
      var matches = quizRegex.exec(window.location.href);
      if (matches) {
        discussionId = matches[1];
      } else {
        throw new Error('Unable to detect discussion ID');
      }
    } catch (e) {
      errorHandler(e);
    }
    return discussionId;
  }

  
  function makeReport( courseId, discussionId ) { //generates CSV of data
    var csv;
    var discussionTitle="";
    var tmpPost;
    var tmpName;
    var blob;
    var savename;
    

    try {
        discussionTitle=document.title.split( ":" )[1].replace(/[^\w]/g, "");
    } catch(e){
      discussionTitle=document.title.replace(/[^\w]/g, "");
    }
    if (debug) console.log( "discussionTitle:", discussionTitle );
    if (debug) console.log( "participants:", participants );
    if (debug) console.log( "discussionPosts:", discussionPosts );
    //put participants into  student array
    for (var i = 0; i < discussionPosts.length; i++) {
      try{ 
        tmpPost = discussionPosts[i].message.replace(/<\/?[^>]+(>|$)/g, "");
      } catch(e){
        tmpPost = "";
      }
      try { 
        tmpName = participants[discussionPosts[i].user_id].display_name.replace(/ /g, "");
      } catch(e){
        tmpName= "";
      }
      if ( tmpName !="" && tmpPost!="" ) {
        //blob = new Blob([csv], {
         // 'type': 'text/plain;charset=utf-8'
        //});
        
        savename = 'course-' + courseId + '-discussion-' + discussionTitle + '-' + tmpName + '-' + discussionPosts[i].id + '.txt';
        if (debug) console.log( "savename:", savename ); 
        if (debug) console.log( "post:", tmpPost ); 
        zip.file( savename, tmpPost ); 
        //saveAs(blob, savename);
        //process reply array
        if ( 'replies' in discussionPosts[i] ) {
          processReplies( courseId, discussionTitle, tmpName, discussionPosts[i].replies );
        }
      }
    }
    zip.generateAsync({type:"blob"})
        .then(function(content) {
        // Force down of the Zip file
        saveAs(content, discussionTitle+".zip");
    });
 
  }

function processReplies( courseId, discussionTitle, msgOwner, replyAr ){
  var tmpReplyObj;
  var tmpName;
  var tmpPost;
  var savename;
  for (var i = 0; i < replyAr.length; i++) {
      tmpReplyObj = replyAr[i];
      try { 
        tmpName = participants[tmpReplyObj.user_id].display_name.replace(/ /g, "");
      } catch(e){
        tmpName= "";
      }
      try{ 
        tmpPost = tmpReplyObj.message.replace(/<\/?[^>]+(>|$)/g, "");
      } catch(e){
        tmpPost = "";
      }
      if ( tmpName !="" && tmpPost!="" && tmpPost.length>20 ) {
       // blob = new Blob([csv], {
       //   'type': 'text/plain;charset=utf-8'
       // });
        
        savename = 'course-' + courseId + '-discussion-' + discussionTitle + '-' + tmpName + '-reply-' + msgOwner + '-' + tmpReplyObj.id  + '.txt';
        if (debug) console.log( "savename:", savename ); 
        if (debug) console.log( "post:", tmpPost ); 
        zip.file( savename, tmpPost ); 
        //saveAs(blob, savename);
        //process reply array
        if ( 'replies' in tmpReplyObj ) {
          processReplies( courseId, discussionTitle, tmpName, tmpReplyObj.replies );
        }
      }
  }
}

function createDiscussionPost() {
   var t="";
    //loop through 
    return t;
  }

    ////////////////////////
  function excelDate(timestamp) {
    var d;
    try {
      if (!timestamp) {
        return '';
      }
      timestamp = timestamp.replace('Z', '.000Z');
      var dt = new Date(timestamp);
      if (typeof dt !== 'object') {
        return '';
      }
      d = dt.getFullYear() + '-' + pad(1 + dt.getMonth()) + '-' + pad(dt.getDate()) + ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
      //d = ""+ pad(dt.getFullYear()-2000) +  pad(1 + dt.getMonth()) +  pad(dt.getDate()) + ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
    } catch (e) {
      errorHandler(e);
    }
    return d;
    function pad(n) {
      return n < 10 ? '0' + n : n;
    }
  }

  function progressbar(x, n) {
    try {
      if (typeof x === 'undefined' || typeof n == 'undefined') {
        if ($('#jj_progress_dialog').length === 0) {
          $('body').append('<div id="jj_progress_dialog"></div>');
          $('#jj_progress_dialog').append('<div id="jj_progressbar"></div><small>It may take a few mins for large courses</small><br><small id="doing"></small>');
          $('#jj_progress_dialog').dialog({
            'title': 'Fetching Report',
            'autoOpen': false,
            'buttons': [
              {
                'text': 'Cancel',
                'click': function () {
                  $('#quiz-submissions-report').one('click', {
                    type: 2
                  }, discussionSubmissionReport);
                  if (debug) console.log( "done set submission report link" );
                  $(this).dialog('close');
                  aborted = true;
                  abortAll();
                  resetData();

                }
              }
            ]
          });
        }
        if ($('#jj_progress_dialog').dialog('isOpen')) {
          $('#jj_progress_dialog').dialog('close');
        } else {
          $('#jj_progressbar').progressbar({
            //'value': false
            'value': 0
          });
          $('#jj_progress_dialog').dialog('open');
          
        }
      } else {
        if (!aborted) {
          var val = n > 0 ? Math.round(100 * x / n)  : false;
          $('#jj_progressbar').progressbar('option', 'value', val);
        }
      }
    } catch (e) {
      errorHandler(e);
    }
    
  }
  function resetData(){
    userData = {};
    quiz_submissions = [];
    attemptAr = new Object();
    pending = - 1;
    fetched = 0;
    needsFetched = 0;
  }

  function errorHandler(e) {
    console.log(e.name + ': ' + e.message);
  }
}) ();

