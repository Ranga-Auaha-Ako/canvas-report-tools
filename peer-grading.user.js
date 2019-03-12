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
// @version     0.1.1
// @grant       none
// ==/UserScript==

// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement

(function () {
  'use strict';
  var userData = {
  };
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
  var debug = 1;
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (mm < 10) {
    mm = '0' + mm;
  }
  today = (yyyy-2000 ) + '-' + mm  + '-' + dd + '-' + Math.floor(Date.now() /1000) ;
  var aborted = false;
  addPeerGradingReportButton();

  function addPeerGradingReportButton() {

    var courseId = getCourseId();
    var assignmentId = getAssignmentId();
    var rubricId;
    var url = '/api/v1/courses/' + courseId + '/assignments/' + assignmentId;
    $.getJSON(url, function (adata, status, jqXHR) {
      try {
        rubricId = adata.rubric_settings.id;
        if (rubricId && $('#peer-grading-report').length === 0) {
          $('#toolbar-1').append('<li class="ui-menu-item" role="presentation"><a id="peer-grading-report" class="ui-corner-all" role="menuitem"><i class="icon-analytics"></i> Peer-Grading Download</a></li>');
          $('#peer-grading-report').one('click', {
            type: 2
          }, peerGradingReport);
        }
      } catch(e){}
    }).fail(function () {
    })
    
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

  function peerGradingReport(e) { //gets the student list
    var rubricId;
    reporttype = e.data.type;
    aborted = false;
    setupPool();
    var courseId = getCourseId();
    var assignmentId = getAssignmentId();
    var url = '/api/v1/courses/' + courseId + '/assignments/' + assignmentId;
    $.getJSON(url, function (adata, status, jqXHR) {
      rubricId = adata.rubric_settings.id;
      console.log( "rubricId:", rubricId );
      var url = '/api/v1/courses/' + courseId + '/sections?include[]=students';
      progressbar();
      pending = 0;
      getStudents( url, courseId, assignmentId, rubricId );

    }).fail(function () {

      if (!aborted) {
        console.log('Failed to get Rubric ID');
      }
      //return rubricId;
    });
    
   
   
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

  function getStudents( url, courseId, assignmentId, rubricId ) { //cycles through the student list
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      pending++;
      $.getJSON(url, function (udata, status, jqXHR) {
        url = nextURL(jqXHR.getResponseHeader('Link'));
        for (var i = 0; i < udata.length; i++) {
          var section = udata[i];
          try {
              if (section.students.length > 0) {
                  for (var j = 0; j < section.students.length; j++) {
                      // login_id === upi
                      var user = section.students[j];
                      var splitname = user.sortable_name.split(',');
                      user.firstname = splitname[1].trim();
                      user.surname = splitname[0].trim();
                      userData[user.id] = user;
                  } // end for
              } // end if length>0
          } catch(e){ continue; }
        }
        if (url) {
          getStudents( url, courseId, assignmentId, rubricId );
        }
        pending--;
        if (pending <= 0) {
         
            getPeerReviewReport( courseId, assignmentId, rubricId );
    
        }
      }).fail(function () {
        pending--;
        throw new Error('Failed to load list of students');
      });
    } catch (e) {
      errorHandler(e);
    }
  }

  function getPeerReviewReport( courseId, assignmentId, rubricId ) { //cycles through student list
    pending = 0;
    fetched = 0;
    var url = '/api/v1/courses/'+ courseId + '/rubrics/'+ rubricId + '?include=peer_assessments';
    if (debug) console.log( "peer assessment url:", url );
    getPeerAssessments( url, courseId, rubricId );
    url = '/api/v1/courses/'+ courseId + '/assignments/' + assignmentId +'/peer_reviews';
    getPeerReview( url, courseId, assignmentId, rubricId );
    
  }

  function getPeerAssessments( url, courseId, rubricId ) { //get peer review data
    var tmpAsetIdAssessorId='';
    var tmpScore = "";
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      pending++;
      $.getJSON(url, function (adata, status, jqXHR) {
        if ( adata.assessments ) {
          url = nextURL(jqXHR.getResponseHeader('Link'));
          for ( var i=0; i< adata.assessments.length; i++ ) { 
            tmpAsetIdAssessorId = adata.assessments[i].artifact_id + "-" +  adata.assessments[i].assessor_id;
            peer_assessments[ tmpAsetIdAssessorId ] = adata.assessments[i].score;
          }
          
          //store only the assessments array
          //peer_assessments.push.apply(peer_assessments, adata.assessments);

          if (url) {
            getPeerAssessments( url, courseId, rubricId );
          }
        
          pending--;
          fetched++;
          progressbar(fetched, needsFetched);
        } else {
          abortAll();
          progressbar();
          console.log( "No assessment data yet!!" );
        }
      
      }).fail(function () {
        pending--;
        fetched++;
        progressbar(fetched, needsFetched);
        if (!aborted) {
          console.log('Some report data failed to load');
        }
      });
    } catch (e) {
      errorHandler(e);
    }
  }

  function getPeerReview( url, courseId, assignmentId, rubricId ) { //get peer review data
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      pending++;
      $.getJSON(url, function (adata, status, jqXHR) {
        url = nextURL(jqXHR.getResponseHeader('Link'));
        peer_reviews.push.apply(peer_reviews, adata);
        if (url) {
          getPeerReview( url, courseId, assignmentId, rubricId );
        }
        pending--;
        fetched++;
        progressbar(fetched, needsFetched);
        if (pending <= 0 && !aborted) {
          makeReport( courseId, assignmentId );
        }
      }).fail(function () {
        pending--;
        fetched++;
        progressbar(fetched, needsFetched);
        if (!aborted) {
          console.log('Some access report data failed to load');
        }
      });
    } catch (e) {
      errorHandler(e);
    }
  }

  function getCourseId() { //identifies course ID from URL
    var courseId = null;
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

 
  function makeReport( courseId, assignmentId ) { //generates CSV of data
    var csv;
    try {
      if (aborted) {
        console.log('Process aborted');
        aborted = false;
        return;
      }
      progressbar();
     
       csv = createPeerAssessmentCSV();
     
      if (csv) {
        var blob = new Blob([csv], {
          'type': 'text/csv;charset=utf-8'
        });
        
        var savename = 'course-' + courseId + '-peerAssessment-' + assignmentId + '-' + today + '.csv';
          saveAs(blob, savename);
          $('#peer-grading-report').one('click', {
            type: 2
          }, peerGradingReport);
       
      } else {
        throw new Error('Problem creating report');
      }
    } catch (e) {
      errorHandler(e);
    }
  }
  
//////////////////////////
function createPeerAssessmentCSV() {
    if (debug){
      console.log( "peer_assessments:", peer_assessments  ); 
      console.log( "peer_reviews:", peer_reviews );
    }
    var fields = [
      'id',
      'sis_user_id',
      'login_id',
      'name'
    ];

    //titleAr to store title for access code

    var titleAr = [
        'Canvas_User_ID',
        'AUID',
        'Username',
        'Display_Name'
    ];
    var peerGradingReportAr=[];
    var canSIS = false;
    var tmpUpi;
    var tmpAr;
    var tmpCode;
    var tmpFieldName;
    var item;
    var userId;
    var user;
    var value;
    var tmpId;
    var tmpReviewerId;
    var punctRE = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-\.\/:;<=>?@\[\]^_`{|}~]/g;
    var spaceRE = /\s+/g;
    var reviewNumber, maxReviewerNumber;
    var tmpAssetId;
    var tmpObjLength;
    maxReviewerNumber = 0;

    //loop through userData
    for (var id in userData) {
        //tmpUpi = userData[id].login_id;
        //tmpAr = [] ;
        console.log( "userData loop id:", id );
        peerGradingReportAr[id] = [];
        peerGradingReportAr[id]['id'] = userData[id].id;
        peerGradingReportAr[id]['sis_user_id'] = userData[id].sis_user_id;
        peerGradingReportAr[id]['login_id'] = userData[id].login_id;
        peerGradingReportAr[id]['name'] = userData[id].name;
    }

    //loop through accessData to save in ontaskReport
     for (var id in peer_reviews ) {
        //get code
        item = peer_reviews[id];
         //try to exclude student profile access
        if (debug) console.log( "peer_reviews item:", item );
        // the student 
        tmpId = item.user_id;
        tmpReviewerId = item.assessor_id;
        tmpAssetId = item.asset_id;
        tmpObjLength = Object.keys( peerGradingReportAr[tmpId] ).length;
        reviewNumber = (tmpObjLength-4)/2+ 1;
        reviewNumber = reviewNumber.toFixed(0);
        if (debug) { 
          console.log( "reviewNumber:", reviewNumber );
          console.log( "targetAssessmentId:", tmpAssetId + "-" + tmpReviewerId );
        }
        if ( peer_assessments[ tmpAssetId + "-" + tmpReviewerId ] !==null ){
          peerGradingReportAr[tmpId]["score"+ reviewNumber] = peer_assessments[ tmpAssetId + "-" + tmpReviewerId ];
        } else {
          peerGradingReportAr[tmpId]["score"+ reviewNumber] = 0;
        }
        
        peerGradingReportAr[tmpId]["reviewer"+ reviewNumber]=tmpReviewerId + ":" + userData[tmpReviewerId].name;
        
        if ( reviewNumber > maxReviewerNumber ){
          maxReviewerNumber = reviewNumber;
          titleAr.push( "score" + reviewNumber ) ;
          titleAr.push( "reviewer" + reviewNumber );
          fields.push( "score" + reviewNumber ) ;
          fields.push( "reviewer" + reviewNumber );
        }

    } // end for

    if (debug) console.log( "fields:", fields );
    var CRLF = '\r\n';


    var t = titleAr.join(',').toLowerCase() + CRLF;//csv first line

//if (debug) { console.log( peerGradingReportAr); }
      //for (var item in peerGradingReportAr) {
      for (var id in userData) {
        user = userData[id];
        userId = user.id;
        
        item = peerGradingReportAr[userId];
       // if (debug) { console.log( userId, item ); }

        for (var j = 0; j < fields.length; j++) {
          tmpFieldName = fields[j];
          if (debug) { console.log(tmpFieldName); }
          value = item[ tmpFieldName ];

          if (value === null || typeof(value)=='undefined') {
            value = '';
          } else {

            if (typeof value === 'string') {
              var quote = false;
              if (value.indexOf('"') > - 1) {
                value = value.replace(/"/g, '""');
                quote = true;
              }
              if (value.indexOf(',') > - 1) {
                quote = true;
              }
              if (quote) {
                value = '"' + value + '"';
              }
            }
          }
          if (j > 0) {
            t += ',';
          }
          t += value;
        }
        t += CRLF;
      }

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
          $('#jj_progress_dialog').append('<div id="jj_progressbar"></div>');
          $('#jj_progress_dialog').dialog({
            'title': 'Fetching Report',
            'autoOpen': false,
            'buttons': [
              {
                'text': 'Cancel',
                'click': function () {
                  $(this).dialog('close');
                  aborted = true;
                  abortAll();
                  pending = - 1;
                  fetched = 0;
                  needsFetched = 0;
                  if (reporttype == 0) {
                    $('#jj_access_report').one('click', {
                      type: 0
                    }, accessReport);
                  }
                  if (reporttype == 1) {
                    $('#jj_student_report').one('click', {
                      type: 1
                    }, accessReport);


                  }
                }
              }
            ]
          });
        }
        if ($('#jj_progress_dialog').dialog('isOpen')) {
          $('#jj_progress_dialog').dialog('close');
        } else {
          $('#jj_progressbar').progressbar({
            'value': false
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
  function errorHandler(e) {
    console.log(e.name + ': ' + e.message);
  }
}) ();

