// ==UserScript==
// @name        Canvas media assignment submissions download
// @author      WenChen Hol
// @namespace   https://github.com/Ranga-Auaha-Ako/canvas-report-tools/
// @description Show assignment override infromation with student names
// @downloadURL https://github.com/Ranga-Auaha-Ako/canvas-report-tools/raw/master/media-assignment-download.user.js
// @include     https://*/courses/*/assignments/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @version     0.1
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
  var courseId;
  var assignmentId;
  var sections = {};
  var debug = 0;
  var submissionAr = [];
  var aborted = false;
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (mm < 10) {
    mm = '0' + mm;
  }
  //courseId = getCourseId();
 // quizId = getQuizId(); 

  today = (yyyy-2000 ) + '-' + mm  + '-' + dd + '-' + Math.floor(Date.now() /1000) ;
  addMediaSubmissionDownloadButton();
  
  function addMediaSubmissionDownloadButton() {

    

    if ($('#media-assignment-download').length === 0) {
        
        $('#sidebar_content').append(
            '<span><a href="javascript:void(0)" id="media-assignment-download" class="ui-corner-all" role="menuitem"><i class="icon-analytics"></i> Student recordings Download</a></span>'
            );

        


        $('#media-assignment-download').one('click', {
        type: 2
        }, mediaSubmissionDownload );
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
      throw new Error('Error configuring AJAX pool');
    }
  }

  function nextURL(linkTxt) {
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

  function mediaSubmissionDownload(){
    pending = 0;
    fetched = 0;
    aborted = false;
    setupPool();
    
    progressbar();
    pending = 0;
    courseId = getCourseId();
    assignmentId = getAssignmentId();
    if ( debug ) console.log( { courseId, assignmentId } );
    if ( !courseId || !assignmentId ){
        return;
    }
    getUserSubmissionInfo( courseId );
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

  function getAssignmentId() { //identifies course ID from URL
    var assignmentId = null;
    try {
      var assignmentRegex = new RegExp('/assignments/([0-9]+)');
      var matches = assignmentRegex.exec(window.location.href);
      if (matches) {
        assignmentId = matches[1];
      } else {
        throw new Error('Unable to detect Assignment ID');
      }
    } catch (e) {
      errorHandler(e);
    }
    return assignmentId;
  }

  function getUserSubmissionInfo(courseId) {
    
    if ( debug ) console.log('in getUsers');
    var chunkSize = 100;
    var chunk;
    var url;
    var i = 0;
    //var n = userList.length;
    pending = 0;
    url = '/api/v1/courses/' + courseId + '/sections?include[]=submission_history&per_page=100';
    //getStudentSubmissionInfo();
    getStudents( url, courseId );
    
  }

 
  function getStudents( url, courseId ) { //cycles through the student list
    try {
      pending++;
      $.getJSON(url, function (udata, status, jqXHR) {
        url = nextURL(jqXHR.getResponseHeader('Link'));
        for (var i = 0; i < udata.length; i++) {
          var section = udata[i];
          try {
              if (section.students.length > 0) {
                  //collect student names
                  for (var j = 0; j < section.students.length; j++) {
                      // login_id === upi
                      var user = section.students[j];

                      userData[user.id] = user;
                      //collect user name in override sections
                      if ( section.id in sections ){
                          sections[ section.id ].push( user.name );
                      } else {
                        sections[ section.id ] = [];  
                        sections[ section.id ].push( user.name );
                      }

                      //studentIdAr.push( user.id );
                  } // end for
                  //if the section in overwrite, collect student names
              } // end if length>0
          } catch(e){ continue; }
        }
        if (debug) console.log( "next url ?", url );
        //if (debug) console.log( "number ss:", studentIdAr.length );
        if (url) {
          getStudents( url, courseId );
        }
        pending--;
        if (debug) console.log( "pending:", pending );

        if (pending <= 0) {

            getStudentSubmissionInfo( );

        } else{}
      }).fail(function () {
        pending--;
        $('#jj_progress_dialog').dialog('close');
        throw new Error('Failed to load list of students');
      });
    } catch (e) {
      pending--;
      $('#jj_progress_dialog').dialog('close');
      throw new Error('Failed to load list of students');
      
    }
  }
  
  function getStudentSubmissionInfo( ){
  
    let url = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions?include[]=submission_history&per_page=100`;
    if (debug) console.log( "getStudentSubmissionInfo url:", url );
    pending = 0;
    needsFetched = userData.length;
    fetched = 0;
    getSubmissions( url );
    
  }
  
  function getSubmissions( submissionUrl ) { //get peer review data
    let studentId = '';
    let startedTest = 0;
    let finishedTest = 0; 
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      if (debug) console.log( "student Data:", userData );
      jQuery("#doing").html( "Fetching submission information <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
      pending++;
      
      $.getJSON(submissionUrl, function (adata, status, jqXHR) {
          let tmpSubmissionAr = adata;

          let url = nextURL(jqXHR.getResponseHeader('Link'));
          //store submission Data
          for ( let i=0; i<tmpSubmissionAr.length;i++ ){
              fetched +=1;
              //progressbar(fetched, needsFetched);

              if  ( tmpSubmissionAr[i].submitted_at  ){
                  let submissionReportAr = {};
                  studentId = tmpSubmissionAr[i].user_id;
                  //studentId = tmpSubmissionAr[i].login_id;
                  
                  if ( debug ) console.log( { studentId } );
                  try {
                    submissionReportAr['id'] = studentId;
                    

                    submissionReportAr['url'] = []; 
                    if ( "submission_history" in tmpSubmissionAr[i] ){
                        if (debug) console.log(tmpSubmissionAr[i].submission_history);
                        for (let j=0; j< tmpSubmissionAr[i].submission_history.length; j++ ){
                            let tmpUrl = tmpSubmissionAr[i].submission_history[j].media_comment["url"];
                            if ( tmpUrl ) {
                                if (debug) console.log({tmpUrl});
                                submissionReportAr['url'].push( tmpUrl );
                            }
                            
                        }

                    }
                    submissionAr.push( submissionReportAr );

                  } catch(e){
                    if (debug) console.log( {studentId} , "not in userData" );
                    continue;
                  }
                  
                      
              }

          } // end for

          if (url && !finishedTest) {
            
            getSubmissions( url );
          } else {
            
              

              
              makeDownload( courseId, assignmentId );
          
          }
      }).fail(function () {
          
          fetched+=1;
          //get next student ip
          makeDownload( courseId, assignmentId );
          
          if (!aborted) {
          console.log('Some report data failed to load');
          }
      });
    } catch (e) {
      errorHandler(e);
    }

  }

  function makeDownload( courseId, assignmentId ) { //generates CSV of data
    
    progressbar();
    if (debug) console.log({submissionAr});
    downloadVideos();

  }

//////////////////////////
async function downloadVideos() {

    let item = "";
    let urlList = [];
    let tmpUrl = "";
    let tmpType = "";
    let tmpName = "";
    for (var id in submissionAr) {
        if (debug) console.log({id});
        item = submissionAr[id];
        let studentId = item.id;
        urlList = submissionAr[id].url;
        for ( let i=0; i<urlList.length;i++){
            tmpUrl = urlList[i];
            
            let urlParams = new URLSearchParams(tmpUrl);
            tmpType = urlParams.get("type");
            
            if ( tmpType ) {
                tmpName = studentId +'-' + i + "." + tmpType;
                await getFile( tmpName, tmpUrl);
            }
            
        }
    
    }

  }

 async function getFile(tmpName, theUrl){
    //get theUrl file type
    theUrl = theUrl.replace( "redirect=", "download="  );
    console.log( theUrl, {tmpName} );
    $.getJSON(theUrl, function (adata, status, jqXHR) {
        console.log( adata );
        let realUrl = adata.url;
        downloadFile( tmpName, realUrl );
    } )
    

  }
  async function downloadFile( tmpName, theUrl ){

    $.ajax({
        url: theUrl ,
        method: 'GET',
        xhrFields: {
            responseType: 'blob'
        },
        success: function (data) {
            var a = document.createElement('a');
            var url = window.URL.createObjectURL(data);
            a.href = url;
            a.download = tmpName;
            document.body.append(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        }
    });

  }
function progressbar(x, n) {
    try {
      if (typeof x === 'undefined' || typeof n == 'undefined') {
        if ($('#jj_progress_dialog').length === 0) {
          $('body').append('<div id="jj_progress_dialog"></div>');
          $('#jj_progress_dialog').append('<!--div id="jj_progressbar"></!--div--><small>It may take a few mins for large courses</small><br><small id="doing"></small>');
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
    submissionAr = [];
    pending = - 1;
    fetched = 0;
    needsFetched = 0;
  }

  
  function errorHandler(e) {
    $('#override').html( '' );
    console.log(e.name + ': ' + e.message);
  }
})();

