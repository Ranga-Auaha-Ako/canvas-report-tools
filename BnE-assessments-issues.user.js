// ==UserScript==
// @name        Canvas BnE assessment information download
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description For Canvas users, this tool generates a .CSV download of B&E assessment information
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/BnE-assessments-issues.user.js
// @include     https://*/accounts/1*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @resource    REMOTE_CSS https://du11hjcvx0uqb.cloudfront.net/dist/brandable_css/new_styles_normal_contrast/bundles/common-1682390572.css
// @version     0.1
// @grant        GM_getResourceText
// @grant        GM_addStyle
// ==/UserScript==
/* global $, jQuery,XLSX,saveAs */

// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement

(function () {
  'use strict';
  var userData = {
  };
  //
  const myCss = GM_getResourceText("REMOTE_CSS");
  GM_addStyle(myCss);
  GM_addStyle(".ui-dialog { z-index:999; }");
  //
  var courses = [];
  var course_assignments = [
  ]; // course_assignments is array of objects
  var reportAr = [];
  var attemptAr = new Object(); //attemptAr is array of objects
  var pending = - 1;
  var fetched = 0;
  var needsFetched = 0;
  var reporttype;
  var ajaxPool;
  var courseId;
  var quizId;
  var queuedAr=[];
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();
  var secondRound = 0;
  var debug = 0;
  var csId = 0;
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (mm < 10) {
    mm = '0' + mm;
  }
  var defaultTermId = 356; // default 2024 semester 2
  var termName = '';

  today = (yyyy-2000 ) + '-' + mm  + '-' + dd + '-' + Math.floor(Date.now() /1000) ;
  var aborted = false;
  $( document ).ready( function(){addQuizSubmissionButton();}  );

  function addQuizSubmissionButton() {

    if ($('#course-assignment-report').length === 0) {
      $('#content-wrapper').prepend('&nbsp;&nbsp;<a href="javascript:void(0)" id="course-assignment-report" class="ui-corner-all" role="menuitem"><i class="icon-analytics"></i> B&E assessments information download</a>');
      
      $('#course-assignment-report').one('click', {
        type: 1
      }, courseAssignmentReport);
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

  function courseAssignmentReport(e) { //gets the student list
    pending = 0;
    fetched = 0;
    reporttype = e.data.type;
    aborted = false;
    setupPool();
    let termId = defaultTermId;
    
    termId = getTermId();
    termName = jQuery("#termFilter").val();

    if (debug) console.log( courseId, quizId );
    
    var url = `/api/v1/accounts/13/courses?enrollment_term_id=${termId}&sort=sis_course_id&order=asc&search_by=course&enrollment_type%5B%5D=student&include%5B%5D=total_students&include%5B%5D=teachers&include%5B%5D=subaccount&include%5B%5D=term&include%5B%5D=concluded&teacher_limit=25&per_page=100&no_avatar_fallback=1`;

    progressbar();
    pending = 0;
    getCourses( url );
  }
  function getTermId() { //identifies course ID from URL
  
    let termId = defaultTermId;
    if (debug) console.log( "in getTermId: window.location", window.location.href );
      try {
        let termRegex = new RegExp('enrollment_term_id=([0-9]+)');
        let matches = termRegex.exec(window.location.href);
        if (matches) {
          termId = matches[1];
        } 
      } catch (e) {
        errorHandler(e);
      }
      return termId;
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

  function getCourses( url) { //cycles through the course list
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      jQuery("#doing").html( "Fetching course informaton <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
      pending++;
      $.getJSON(url, function (udata, status, jqXHR) {
        url = nextURL(jqXHR.getResponseHeader('Link'));
        for (var i = 0; i < udata.length; i++) {
          let course = udata[i];
          if ( course.time_zone !="Pacific/Auckland" ) {
            console.log( course );
          }
          //console.log( course );
          try {
              courses.push( course );
              
          } catch(e){ continue; }
        }
        if (url) {
          getCourses( url );
        }
        pending--;
        if (pending <= 0) {
            console.log( "number of courses:", courses.length );
            getcourseAssignmentReport( );

        }
      }).fail(function () {
        pending--;
        throw new Error('Failed to load list of students');
      });
    } catch (e) {
      errorHandler(e);
    }
  }

  function getcourseAssignmentReport() { //cycles through course list
    pending = 0;
    fetched = 0;
    needsFetched = Object.getOwnPropertyNames( courses ).length;
    if (debug) console.log( "needsFetched:", needsFetched );
    
    getAssignments();
    
  }

  function getRemain(){
    console.log( "run getRemain:", secondRound );
    if ( queuedAr.length >0 ) {

      setTimeout(function () {
        let clonedAr = queuedAr.slice();
        queuedAr = [];
        secondRound += 1;
        for (let i = 0; i < clonedAr.length; i++) {
          getAssignments( clonedAr[i] );
        }
        getRemain();
      }, 40000 ); // delay 5s and run
    }

  }

  
  function getAssignments( ) { //get course assignment data
    let tmpQuizSubmissions;
    let tmpItem;
    let tmpUrl;
    let courseId =  courses[csId].id;
    let url = '/api/v1/courses/' + courseId + '/assignment_groups?include[]=assignments&override_assignment_dates=false';
    
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      jQuery("#doing").html( "Fetching Course Assignments information <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
      pending++;
      progressbar(fetched, needsFetched);
      $.getJSON(url, function (adata, status, jqXHR) {
        // adata is an array of assignment_group objects
        //loop through assignment_group
        
        if ( adata.length>0 ) {
          // group_weight
          for ( let i=0; i<adata.length;i++ ){
            let group_weight = adata[i].group_weight;

            //get group assignments
            if ( (group_weight>= 5) && ( "assignments" in adata[i] ) && adata[i].assignments.length >0 ) {
              
              let tmpAssignments = adata[i].assignments;
              let totalPoints = 0;
              for ( let j=0; j<tmpAssignments.length; j++ ){
                totalPoints += tmpAssignments[j].points_possible;
              }
              for ( let j=0; j<tmpAssignments.length; j++ ){
                //if over 5% assignment, check if avail_time over 1439 mins
                let tmpWeight = (tmpAssignments[j].points_possible)/totalPoints * group_weight ;
                if (debug){
                  console.log( "totalPoints", totalPoints );
                  console.log( "tmpWeight:", tmpWeight );
                  console.log( tmpAssignments[j] );
                }
                if ( tmpWeight >= 5 ){
                  let  endT = Date.parse( tmpAssignments[j].due_at );
                  let  startT = Date.parse( tmpAssignments[j].unlock_at );
                  if ( tmpAssignments[j].lock_at  ){
                    if ( Date.parse( tmpAssignments[j].lock_at ) > endT ){
                      endT = Date.parse( tmpAssignments[j].lock_at );
                    }
                  }
                  let time_allowed =  Math.round( (endT - startT )/60000 );
                  //console.log( time_allowed );
                  //if ( time_allowed < 1438 && time_allowed >0 ) {
                  if ( time_allowed < 1438  ) {
                    //store the record in reportAr
                    // course_code, name, subaccount_name, total_students, assignment_group( name ), assignment name, submission_types, weight, time_allowed
                    let tmpAr =  {};
                    tmpAr[ "course_code" ] =  courses[csId].course_code;
                    tmpAr[ "name" ] = courses[csId].name;
                    tmpAr[ "subaccount_name" ] = courses[csId].subaccount_name;
                    tmpAr[ "total_students" ] = courses[csId].total_students;
                    tmpAr[ "assignment_group" ] = adata[i].name;
                    tmpAr[ "assignment_name" ] = tmpAssignments[j].name;
                    tmpAr[ "submission_types" ] = tmpAssignments[j].submission_types.join( " " );
                    tmpAr[ "weight" ] =  tmpWeight;
                    tmpAr[ "time_allowed" ] = time_allowed ;
                    if ( tmpAssignments[j].due_at ) {
                      let duStr = excelDate( tmpAssignments[j].due_at );
                      [ tmpAr[ "due_date" ] , tmpAr["due_time"] ] = duStr.split( ' ' );
                     
                    } else {
                      tmpAr[ "due_date" ] = '';
                      tmpAr[ "due_time" ] = '';
                    }
                    
                    if ( tmpAssignments[j].unlock_at ) {
                      let unlockStr = excelDate( tmpAssignments[j].unlock_at );
                      [tmpAr[ "unlock_date" ],  tmpAr["unlock_time"] ] = unlockStr.split( ' ' );
                      
                    } else {
                      tmpAr[ "unlock_date" ] = '';
                      tmpAr[ "unlock_time" ] = '';
                    }
                    if ( tmpAssignments[j].lock_at ) {
                      let lockStr = excelDate( tmpAssignments[j].lock_at );
                      [tmpAr[ "lock_date" ], tmpAr["lock_time"] ] = lockStr.split( ' ' );
                     
                    } else {
                      tmpAr[ "lock_date" ] = '';
                      tmpAr[ "lock_time" ] = '';
                    }
                    tmpAr["total_weight"] = group_weight;
                    tmpAr["total_points"] = totalPoints;
                    tmpAr["points"] = tmpAssignments[j].points_possible;
                    tmpAr[ "url" ] =  tmpAssignments[j].html_url;
                    reportAr.push( tmpAr );
                    if (debug){
                      console.log( "push tmpAr:", tmpAr );
                    }
                  }
                }
              }

            }
            

          }
        }
        //url = nextURL(jqXHR.getResponseHeader('Link'));

        //course_assignments.push.apply( course_assignments, adata );
        
        
        pending--;
        fetched+=1;
        csId +=1;
        if ( csId < courses.length ){
          getAssignments();
        }
        progressbar(fetched, needsFetched);
        
        if (debug) console.log( "pending:", pending  );
        if (pending <= 0 && !aborted) {
          makeReport(  );
        }
      }).fail(function () {
        
        //if ( secondRound > 3 ) {
          pending--;
          fetched+=1;
          progressbar(fetched, needsFetched);
        //}

        //if (!aborted && ! secondRound ) {
          console.log('Some report data failed to load:', url );
          csId +=1;
          if ( csId < courses.length ){
            getAssignments();
          }
          //queuedAr.push(csId);
        //}
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

  
  function makeReport( ) { //generates CSV of data
    var csv;
    
    
    try {
      if (aborted) {
        console.log('Process aborted');
        aborted = false;
        return;
      }
      progressbar();

       csv = createAssignmentsCSV();

      if (csv) {
        var blob = new Blob([csv], {
          'type': 'text/csv;charset=utf-8'
        });
        
        var savename = `B&E-${termName}-assignments-info-${today}.csv`;
        saveAs(blob, savename);
        $('#course-assignment-report').one('click', {
        type: 1
        }, courseAssignmentReport);
        resetData();

      } else {
        throw new Error('Problem creating report');
      }
    } catch (e) {
      errorHandler(e);
    }
  }

//////////////////////////
function createAssignmentsCSV() {
    if (debug){

      
      console.log( "reportAr", reportAr  );
      
    }
    
    var fields = [
      'course_code',
      'name',
      'subaccount_name',
      'total_students',
      'assignment_group',
      'assignment_name',
      'submission_types',
      "total_weight",
      "total_points",
      'weight',
      "points",
      'due_date',
      'due_time',
      'unlock_date',
      'unlock_time',
      'lock_date',
      'lock_time',
      'time_allowed', 
      'url'
    ];

    //titleAr to store title for access code

    var titleAr = [
      'course_code',
      'name',
      'subaccount_name',
      'total_students',
      'assignment_group',
      'assignment_name',
      'submission_types',
      "total_weight",
      "total_points",
      'weight',
      "points",
      'due_date',
      'due_time',
      'unlock_date',
      'unlock_time',
      'lock_date',
      'lock_time',
      'time_allowed(minutes)',
      'url'
    ];
    var courseAssignmentReportAr=[];
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
    
  

    
    var CRLF = '\r\n';


    var t = titleAr.join(',').toLowerCase() + CRLF;//csv first line

//if (debug) { console.log( courseAssignmentReportAr); }
      //for (var item in courseAssignmentReportAr) {
      for (let i=0;i< reportAr.length;i++ ) {
        let item = reportAr[i];
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
          $('#jj_progress_dialog').append('<div id="jj_progressbar"></div><small>It may take a few mins to generate the report</small><br><small id="doing"></small>');
          $('#jj_progress_dialog').dialog({
            'title': 'Fetching Report',
            'autoOpen': false,
            'buttons': [
              {
                'text': 'Cancel',
                'click': function () {
                  $('#course-assignment-report').one('click', {
                    type: 2
                  }, courseAssignmentReport);
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
    course_assignments = [];
    attemptAr = new Object();
    pending = - 1;
    fetched = 0;
    needsFetched = 0;
  }

  function errorHandler(e) {
    console.log(e.name + ': ' + e.message);
  }
}) ();

