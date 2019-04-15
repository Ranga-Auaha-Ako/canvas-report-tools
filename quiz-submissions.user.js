// ==UserScript==
// @name        Canvas quiz submissions information download
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description For Canvas users at the University of Auckland, this tool generates a .CSV download of the peer marking record in an peer-marking assignent
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/peer-marking.js
// @include     https://*/courses/*/quizzes/*
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
 
  //
  var quiz_submissions = [
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
  addQuizSubmissionButton();

  function addQuizSubmissionButton() {

    var courseId = getCourseId();
    var quizId = getQuizId();

    //https://canvas.auckland.ac.nz:443/api/v1/courses/29897/quizzes/25662/submissions?include[]=user
      //try {

        if ($('#quiz-submissions-report').length === 0) {
          $('.page-action-list').append('<li><a href="javascript:void(0)" id="quiz-submissions-report" class="ui-corner-all" role="menuitem"><i class="icon-analytics"></i> Quiz Submissions Download</a></li>');
          $('#quiz-submissions-report').one('click', {
            type: 2
          }, quizSubmissionReport);
        }
      //} catch(e){}


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

  function quizSubmissionReport(e) { //gets the student list
    pending = 0;
    fetched = 0;
    reporttype = e.data.type;
    aborted = false;
    setupPool();
    var courseId = getCourseId();
    var quizId = getQuizId();
    if (debug) console.log( courseId, quizId );
    var url = '/api/v1/courses/' + courseId + '/sections?include[]=students';
    progressbar();
    pending = 0;
    getStudents( url, courseId, quizId );

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

  function getStudents( url, courseId, quizId ) { //cycles through the student list
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
          getStudents( url, courseId, quizId );
        }
        pending--;
        if (pending <= 0) {

            getQuizSubmissionReport( courseId, quizId );

        }
      }).fail(function () {
        pending--;
        throw new Error('Failed to load list of students');
      });
    } catch (e) {
      errorHandler(e);
    }
  }

  function getQuizSubmissionReport( courseId, quizId ) { //cycles through student list
    pending = 0;
    fetched = 0;
    
    var url = '/api/v1/courses/'+ courseId + '/quizzes/' + quizId + '/submissions?include[]=submission';
    getQuizSubmissions( url, courseId, quizId );

  }


  function getQuizSubmissions( url, courseId, quizId ) { //get peer review data
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      pending++;
      progressbar(fetched, needsFetched);
      $.getJSON(url, function (adata, status, jqXHR) {
        url = nextURL(jqXHR.getResponseHeader('Link'));
        quiz_submissions.push.apply(quiz_submissions, adata["quiz_submissions"]);
        if (url) {
          getQuizSubmissions( url, courseId, quizId );
        }
        pending--;
        fetched++;
        progressbar(fetched, needsFetched);
        if (pending <= 0 && !aborted) {
          makeReport( courseId, quizId );
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

  function getQuizId() { //identifies quiz ID from URL
    var quizId = null;
    try {
      var quizRegex = new RegExp('/quizzes/([0-9]+)');
      var matches = quizRegex.exec(window.location.href);
      if (matches) {
        quizId = matches[1];
      } else {
        throw new Error('Unable to detect quiz ID');
      }
    } catch (e) {
      errorHandler(e);
    }
    return quizId;
  }


  function makeReport( courseId, quizId ) { //generates CSV of data
    var csv;
    try {
      if (aborted) {
        console.log('Process aborted');
        aborted = false;
        return;
      }
      progressbar();

       csv = createQuizSubmissionCSV();

      if (csv) {
        var blob = new Blob([csv], {
          'type': 'text/csv;charset=utf-8'
        });

        var savename = 'course-' + courseId + '-quizSubmissions-' + quizId + '-' + today + '.csv';
          saveAs(blob, savename);
          $('#peer-grading-report').one('click', {
            type: 2
          }, getQuizSubmissionReport);

      } else {
        throw new Error('Problem creating report');
      }
    } catch (e) {
      errorHandler(e);
    }
  }

//////////////////////////
function createQuizSubmissionCSV() {
    if (debug){
       
      console.log( "quiz_submissions:", quiz_submissions );
    }
    var fields = [
      'id',
      'sis_user_id',
      'login_id',
      'name',
      "time_spent",
        'score',
        'kept_score',
        'started_at',
        "end_at",
        "finished_at",
        "attempt",
        "workflow_state",
        "fudge_points",
        "quiz_points_possible",
        "extra_attempts",
        "extra_time",
        "manually_unlocked",
        "score_before_regrade",
        "has_seen_results",
        "attempts_left",
        "overdue_and_needs_submission",
        "excused?"
    ];

    //titleAr to store title for access code

    var titleAr = [
        'Canvas_User_ID',
        'AUID',
        'Username',
        'Display_Name',
        "time_spent",
        'score',
        'kept_score',
        'started_at',
        "end_at",
        "finished_at",
        "attempt",
        "workflow_state",
        "fudge_points",
        "quiz_points_possible",
        "extra_attempts",
        "extra_time",
        "manually_unlocked",
        "score_before_regrade",
        "has_seen_results",
        "attempts_left",
        "overdue_and_needs_submission",
        "excused?"
    ];
    var quizSubmissionReportAr=[];
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
        if (debug) console.log( "userData loop id:", id );
        quizSubmissionReportAr[id] = [];
        quizSubmissionReportAr[id]['id'] = userData[id].id;
        quizSubmissionReportAr[id]['sis_user_id'] = userData[id].sis_user_id;
        quizSubmissionReportAr[id]['login_id'] = userData[id].login_id;
        quizSubmissionReportAr[id]['name'] = userData[id].name;
    }
    if (debug) console.log( 'quiz_submissions:', quiz_submissions );
    //loop through quiz_submissions
     for (var id in quiz_submissions ) {
        //get code
        item = quiz_submissions[id];
         //try to exclude student profile access
        if (debug) console.log( "quiz_submissions item:", item );
        // the student
        tmpId = item.user_id;
        quizSubmissionReportAr[tmpId]['score'] = item['score'];
        quizSubmissionReportAr[tmpId]['kept_score'] = item['kept_score'];
        quizSubmissionReportAr[tmpId]['started_at'] = item['started_at'];
        quizSubmissionReportAr[tmpId]["end_at"] = item['end_at'];
        quizSubmissionReportAr[tmpId]["finished_at"] = item['finished_at'];
        quizSubmissionReportAr[tmpId][ "attempt"] = item['attempt'];
        quizSubmissionReportAr[tmpId]["workflow_state"] = item['workflow_state'];
        quizSubmissionReportAr[tmpId]["fudge_points"] = item['fudge_points'];
        quizSubmissionReportAr[tmpId][ "quiz_points_possible"] = item['quiz_points_possible'];
        quizSubmissionReportAr[tmpId]["extra_attempts"] = item['extra_attempts'];
        quizSubmissionReportAr[tmpId][ "extra_time"] = item['extra_time'];
        quizSubmissionReportAr[tmpId]["manually_unlocked"] = item['manually_unlocked'];
        quizSubmissionReportAr[tmpId]["score_before_regrade"] = item['score_before_regrade'];
        quizSubmissionReportAr[tmpId]["has_seen_results"] = item['has_seen_results'];
        quizSubmissionReportAr[tmpId]["time_spent"] = item['time_spent'];
        quizSubmissionReportAr[tmpId][ "attempts_left"] = item['attempts_left'];
        quizSubmissionReportAr[tmpId]["overdue_and_needs_submission"] = item['overdue_and_needs_submission'];
        quizSubmissionReportAr[tmpId]["excused?"] = item['excused'];

    } // end for

    if (debug) console.log( "quizSubmissions:", quizSubmissionReportAr );
    var CRLF = '\r\n';


    var t = titleAr.join(',').toLowerCase() + CRLF;//csv first line

//if (debug) { console.log( quizSubmissionReportAr); }
      //for (var item in quizSubmissionReportAr) {
      for (var id in userData) {
        user = userData[id];
        userId = user.id;

        item = quizSubmissionReportAr[userId];
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

