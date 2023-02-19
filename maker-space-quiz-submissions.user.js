// ==UserScript==
// @name        Maker Space Canvas quiz submissions information download
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description For Canvas users, this tool generates a .CSV download of the quiz submissions information
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/maker-space-quiz-submissions.user.js
// @include     https://*/courses/*/quizzes/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @version     0.1
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
  ]; // quiz_submissions is array of objects
  var attemptAr = new Object(); //attemptAr is array of objects
  var pending = - 1;
  var fetched = 0;
  var needsFetched = 0;
  var reporttype;
  var ajaxPool;
  var courseId;
  var quizId;
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();
  var debug = 0;
  var tmpFaculty = "";
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
  addQuizSubmissionButton();

  function addQuizSubmissionButton() {

    //https://canvas.auckland.ac.nz:443/api/v1/courses/29897/quizzes/25662/submissions?include[]=user
      //try {

        if ($('#maker-space-quiz-submissions-report').length === 0) {
          $('.page-action-list').append('<li><a href="javascript:void(0)" id="maker-space-quiz-submissions-report" class="ui-corner-all" role="menuitem"><i class="icon-analytics"></i> Maker Space Student submissions Download</a></li>');
          $('#maker-space-quiz-submissions-report').one('click', {
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
    courseId = getCourseId();
    quizId = getQuizId();
    if (debug) console.log( courseId, quizId );
    var url = '/api/v1/courses/' + courseId + '/sections?include[]=students&include[]=email&per_page=50';
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
      jQuery("#doing").html( "Fetching student informaton <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
      pending++;
      $.getJSON(url, async function (udata, status, jqXHR) {
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
            getFacultyInfo();
            //getQuizSubmissionReport( courseId, quizId );

        }
      }).fail(function () {
        pending--;
        throw new Error('Failed to load list of students');
      });
    } catch (e) {
      errorHandler(e);
    }
  }
  function getFacultyInfo(){
    
    for (var id in userData) {
        tmpFaculty = { "affiliate":"", "faculty":"" };
        console.log( "get faculty information:", userData[id].login_id );
        ldapUserDetail( id, userData[id].login_id );
        //console.log( tmpFaculty );
    }
    getQuizSubmissionReport( courseId, quizId );
  }
  function ldapUserDetail( id, upi ){
    if ( upi=='' ){
        return;
    }
    let ldapUrl = 'https://flexiblelearning.auckland.ac.nz/temp/getUser.php?u=' + upi ;
    $.getJSON(ldapUrl, function (udata, status, jqXHR){
        console.log( udata );
        userData[id].affiliate = udata.affiliate;
        userData[id].faculty = udata.faculty;
        
    } ).fail(function () {
        throw new Error('Failed to load student');
        return;
    });
  }
  function getQuizSubmissionReport( courseId, quizId ) { //cycles through student list
    pending = 0;
    fetched = 0;
    needsFetched = Object.getOwnPropertyNames(userData).length;
    if (debug) console.log( "needsFetched:", needsFetched );
    //var url = '/api/v1/courses/'+ courseId + '/quizzes/' + quizId + '/submissions?include[]=submission&per_page=50';
    var url = '/api/v1/courses/'+ courseId + '/quizzes/' + quizId + '/submissions?per_page=50';
    
    getQuizSubmissions( url, courseId, quizId );

  }


  function getQuizSubmissions( url, courseId, quizId ) { //get peer review data
    var tmpQuizSubmissions;
    var tmpItem;
    var tmpUrl;
    
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      jQuery("#doing").html( "Fetching Quiz Submissions information <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
      pending++;
      progressbar(fetched, needsFetched);
      $.getJSON(url, function (adata, status, jqXHR) {
        tmpQuizSubmissions = adata["quiz_submissions"];

        url = nextURL(jqXHR.getResponseHeader('Link'));
        quiz_submissions.push.apply(quiz_submissions, adata["quiz_submissions"]);
        
        if (url) {
          getQuizSubmissions( url, courseId, quizId );
        }
        pending--;
        fetched+=50;
        progressbar(fetched, needsFetched);
        for (var id in tmpQuizSubmissions ) {
          tmpItem = tmpQuizSubmissions[id];
          if( tmpItem["attempt"] >1 ) {
            //get first attempt time/score record
            tmpUrl =  '/api/v1/courses/'+ courseId + '/quizzes/' + quizId + '/submissions/' +  tmpItem.id + '?attempt=' + 1;
            //console.log( "attempt url", tmpUrl );
            pending ++;
            $.getJSON(tmpUrl, function (attemptData, status, jqXHR) {
              //if ( ! attemptAr.includes( tmpItem.id ) ) {
                attemptAr[ attemptData["quiz_submissions"][0].id ] = new Object();
              //}
              attemptAr[ attemptData["quiz_submissions"][0].id ]["time_spent_1"] = attemptData["quiz_submissions"][0].time_spent;
              attemptAr[ attemptData["quiz_submissions"][0].id ]["score_1"] = attemptData["quiz_submissions"][0].score;
              if (debug) console.log( "attemptAr:", attemptData["quiz_submissions"][0].id, attemptData["quiz_submissions"][0].time_spent,attemptData["quiz_submissions"][0].score  );
              if (debug) console.log( attemptAr );
              pending--;
              //fetched++;
              //console.log( "pending:", pending  );
              if (pending <= 0 && !aborted) {
                makeReport( courseId, quizId );
              }
            }).fail(function () {
              pending--;
              //fetched++;
              //progressbar(fetched, needsFetched);
              if (!aborted) {
                console.log('Some report data failed to load');
              }
            });
            
          }
        }
        if (debug) console.log( "pending:", pending  );
        if (pending <= 0 && !aborted) {
          
          makeReport( courseId, quizId );
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

  function getQuizId() { //identifies quiz ID from URL
    var quizId = null;
    if (debug) console.log( "in getQuizId: window.location", window.location.href );

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
    var quizTitle="";
    try {
        quizTitle=document.title.split( ":" )[0].replace(/[^\w]/g, "");
    } catch(e){}
    
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
        
        var savename = 'course-' + courseId + '-quizSubmissions-' + quizTitle + '-' + today + '.csv';
          saveAs(blob, savename);
          $('#maker-space-quiz-submissions-report').one('click', {
            type: 2
          }, quizSubmissionReport);
          resetData();

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
      console.log( "attemptAr", attemptAr  );
      
    }
    //Timestamp / Quiz Score / Student ID Number / University of Auckland UPI / First Name / Last Name / Email / UoA Affiliation (if possible) / Faculty (if possible)

    var fields = [
      'finished_at',
      'kept_score',
      'sis_user_id',
      'login_id',
      'first_name', 
      'last_name',
      'email',
      'affiliate',
      'faculty'
    ];

    //titleAr to store title for access code

    var titleAr = [
        "Timestamp",
        'Score',
        'AUID',
        'Username',
        'First Name',
        'Last Name',
        'Email', 
        'UoA Affiliation', 
        'Faculty'
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
    var tmpFaculty;
    maxReviewerNumber = 0;

    //loop through userData
    for (var id in userData) {
        //tmpUpi = userData[id].login_id;
        //tmpAr = [] ;
        tmpFaculty=["",""];
        if (debug) console.log( "userData loop id:", id );
        quizSubmissionReportAr[id] = [];
        quizSubmissionReportAr[id]['id'] = userData[id].id;
        quizSubmissionReportAr[id]['sis_user_id'] = userData[id].sis_user_id;
        quizSubmissionReportAr[id]['login_id'] = userData[id].login_id;
        [ quizSubmissionReportAr[id]['last_name'], quizSubmissionReportAr[id]['first_name'] ] = userData[id].sortable_name.split(",");
        quizSubmissionReportAr[id]['email'] = userData[id].email;
        quizSubmissionReportAr[id]['affiliate'] = userData[id].affiliate;
        quizSubmissionReportAr[id]['faculty'] = userData[id].faculty;
        //console.log( "get faculty information:", userData[id].login_id );
        //tmpFaculty = await ldapUserDetail( userData[id].login_id );
        //console.log( tmpFaculty );
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
        quizSubmissionReportAr[tmpId]["finished_at"] = item['finished_at'];
        //quizSubmissionReportAr[tmpId][ "attempt"] = item['attempt'];
        quizSubmissionReportAr[tmpId]["workflow_state"] = item['workflow_state'];
        quizSubmissionReportAr[tmpId]["fudge_points"] = item['fudge_points'];
        //quizSubmissionReportAr[tmpId][ "quiz_points_possible"] = item['quiz_points_possible'];
        //quizSubmissionReportAr[tmpId]["extra_attempts"] = item['extra_attempts'];
        //quizSubmissionReportAr[tmpId][ "extra_time"] = item['extra_time'];
        //quizSubmissionReportAr[tmpId]["manually_unlocked"] = item['manually_unlocked'];
        //quizSubmissionReportAr[tmpId]["score_before_regrade"] = item['score_before_regrade'];
        //quizSubmissionReportAr[tmpId]["has_seen_results"] = item['has_seen_results'];
        //quizSubmissionReportAr[tmpId]["time_spent"] = item['time_spent'];
        //quizSubmissionReportAr[tmpId][ "attempts_left"] = item['attempts_left'];
        //quizSubmissionReportAr[tmpId]["overdue_and_needs_submission"] = item['overdue_and_needs_submission'];
        //quizSubmissionReportAr[tmpId]["excused?"] = item['excused'];
        //try to add first attempt and score
        //try {
          //quizSubmissionReportAr[tmpId]["time_spent_1"] = attemptAr[item.id]["time_spent_1"];
          //quizSubmissionReportAr[tmpId]["score_1"] = attemptAr[item.id]["score_1"];
        //} catch(e){}
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
          $('#jj_progress_dialog').append('<div id="jj_progressbar"></div><small>It may take a few mins for large courses</small><br><small id="doing"></small>');
          $('#jj_progress_dialog').dialog({
            'title': 'Fetching Report',
            'autoOpen': false,
            'buttons': [
              {
                'text': 'Cancel',
                'click': function () {
                  $('#maker-space-quiz-submissions-report').one('click', {
                    type: 2
                  }, quizSubmissionReport);
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

