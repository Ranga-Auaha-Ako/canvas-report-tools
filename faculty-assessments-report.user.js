// ==UserScript==
// @name        UoA faculty assessment report download
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description For Canvas users, this tool generates a .CSV download of faculty assessment information
// @downloadURL https://github.com/Ranga-Auaha-Ako/canvas-report-tools/raw/master/faculty-assessments-report.user.js
// @include     https://*/accounts/1*
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
  var faculties = {"Humanities":"Arts",
  "Social Sciences":"Arts",
  "Cultures, Languages and Linguistics":"Arts",
  "Humanities":"Arts",
  "Applied Language Studies and Linguistics":"Arts",
  "Māori and Pacific Studies":"Arts",
  "Accounting and Finance":"Business and Economics",
  "Architecture and Planning":"Creative Arts and Industries",
  "Biological Sciences":"Science",
  "Chemical and Materials Engineering":"Engineering",
  "Chemical Sciences":"Science",
  "Civil and Environmental Engineering":"Engineering",
  "Commercial Law":"Business and Economics",
  "Computer Science":"Science",
  "Counselling, Human Services and Social Work":"Arts",
  "Critical Studies in Education":"Education",
  "Curriculum and Pedagogy":"Education",
  "Dance Studies Programme":"Creative Arts and Industries",
  "Economics":"Business and Economics",
  "Electrical and Computer Engineering":"Engineering",
  "Engineering":"Engineering",
  "Engineering Science":"Engineering",
  "Environment":"Science",
  "Exercise Sciences":"Science",
  "Faculty Administration Education":"Education",
  "Faculty Administration Medical and Health Sciences":"FMHS",
  "Fine Arts":"Creative Arts and Industries",
  "Information Systems and Operations Management":"Business and Economics",
  "Law":"Law",
  "Learning Development and Professional Practice":"Education",
  "Management and International Business":"Business and Economics",
  "Marine Science":"Science",
  "Marketing":"Business and Economics",
  "Mathematics":"Science",
  "Mechanical Engineering":"Engineering",
  "Medical Sciences":"FMHS",
  "Medicine":"FMHS",
  "Music":"Creative Arts and Industries",
  "Nursing":"FMHS",
  "Pharmacy":"FMHS",
  "Physics":"Science",
  "Population Health":"FMHS",
  "Property":"Business and Economics",
  "Psychology":"Science",
  "Social Sciences":"Arts",
  "Statistics":"Science",
  "Te Kupenga Hauora Maori":"FMHS",
  "Te Puna Wananga":"Education"};
  
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
  var CRLF = '\r\n';
  var LF ='\n';
  var debug = 0;
  var csId = 0;
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (mm < 10) {
    mm = '0' + mm;
  }
  var defaultTermId = 243; // default 2023 semester 1
  //courseId = getCourseId();
 // quizId = getQuizId(); 

  today = (yyyy-2000 ) + '-' + mm  + '-' + dd + '-' + Math.floor(Date.now() /1000) ;
  var aborted = false;
  $( document ).ready( function(){addQuizSubmissionButton();}  );

  function addQuizSubmissionButton() {

    //https://canvas.auckland.ac.nz:443/api/v1/courses/29897/quizzes/25662/submissions?include[]=user
      //try {

        if ($('#course-all-assignment-report').length === 0) {
          $('#content-wrapper').prepend('<a href="javascript:void(0)" id="course-all-assignment-report" class="ui-corner-all" role="menuitem"><i class="icon-analytics"></i> course assessments information download</a>');
          
          $('#course-all-assignment-report').one('click', {
            type: 1
          }, allCourseAssignmentReport0);
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

  function allCourseAssignmentReport0(e) { //gets the student list
    pending = 0;
    fetched = 0;
    reporttype = e.data.type;
    aborted = false;
    setupPool();
    let termId = defaultTermId;
    
    if (debug) console.log( courseId, quizId );
    // to get enrollment_term_id from url
    termId = getTermId();
    //enrollment_term_id : 240, summer school, 243 - semester 1, 241 - quarter 1, 244 - quarter 2, 246 - quarter 3, 245 - semester 2, 247 - quarter 4
    var url = `/api/v1/accounts/1/courses?enrollment_term_id=${termId}&sort=sis_course_id&order=asc&search_by=course&enrollment_type%5B%5D=student&include%5B%5D=total_students&include%5B%5D=teachers&include%5B%5D=subaccount&include%5B%5D=term&include%5B%5D=concluded&teacher_limit=25&per_page=100&no_avatar_fallback=1`;
    

    progressbar();
    pending = 0;
    getCourses( url );
    //getCourses( url1 ); // for quarter 2 courses
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
            //console.log( "number of courses:", courses.length );
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
    
    getAssignmentsAll(  );
    
  }

 
  function getAssignmentsAll( ) { //get course assignment data
    
    let courseId =  courses[csId].id;
    let url = '/api/v1/courses/' + courseId + '/assignment_groups?include[]=assignments&override_assignment_dates=false&include[]=overrides';
    //let urlOverrides = '/api/v1/courses/' + courseId + '/assignment_groups?include[]=assignments&override_assignment_dates=true';
    let total_weight = 0;
    
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      jQuery("#doing").html( "Fetching Course assessments information <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
      pending++;
      progressbar(fetched, needsFetched);
      $.getJSON(url, function (adata, status, jqXHR) {
        // adata is an array of assignment_group objects
        //loop through assignment_group
        
        if ( adata.length>0 ) {
          // group_weight
          let tmpAr =  {};
          tmpAr["url"] = 'https://canvas.auckland.ac.nz/courses/' + courses[csId].id;
          tmpAr[ "course_code" ] =  courses[csId].course_code;
          tmpAr[ "name" ] = courses[csId].name;
          tmpAr[ "subaccount_name" ] = courses[csId].subaccount_name;
          if ( courses[csId].subaccount_name in faculties ){
            tmpAr["faculty"]= faculties[ courses[csId].subaccount_name ]
          } else {
            tmpAr["faculty"] = courses[csId].subaccount_name ;
          }
          tmpAr[ "total_students" ] = courses[csId].total_students;
   
          for ( let i=0; i<adata.length;i++ ){
            if ( adata[i].group_weight ){
                total_weight += adata[i].group_weight;
            }
            
          }
          tmpAr[ "total_weight" ] = total_weight;
          reportAr.push( tmpAr );
        }
    
        
        pending--;
        fetched+=1;
        csId +=1;
        if ( csId < courses.length ){
          getAssignmentsAll();
        }
        progressbar(fetched, needsFetched);
        
        if (debug) console.log( "pending:", pending  );
        if (pending <= 0 && !aborted) {
          makeReport(  );
        }
      }).fail(function () {
        
       
          pending--;
          fetched+=1;
          progressbar(fetched, needsFetched);
        

        //if (!aborted && ! secondRound ) {
          console.log('Some report data failed to load:', url );
          csId +=1;
          if ( csId < courses.length ){
            getAssignmentsAll();
          }
          //queuedAr.push(csId);
        //}
      });
    } catch (e) {
      errorHandler(e);
    }
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
        
        var savename = '2023-term-all-assignments-' + today + '.csv';
        saveAs(blob, savename);
          $('#course-assignment-report').one('click', {
            type: 1
          }, allCourseAssignmentReport0);
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
    /*
    tmpAr[ "course_code" ] =  courses[csId].course_code;
                    tmpAr[ "name" ] = courses[csId].name;
                    tmpAr[ "subaccount_name" ] = courses[csId].subaccount_name;
                    tmpAr[ "total_students" ] = courses[csId].total_students;
                    tmpAr[ "assignment_group" ] = adata[i].name;
                    tmpAr[ "assignment_name" ] = tmpAssignments[j].name;
                    tmpAr[ "submission_types" ] = tmpAssignments[j].submission_types.join( " " );
                    tmpAr[ "weight" ] =  tmpWeight;
                    tmpAr[ "time_allowed" ] = ( endT - startT )/60 ;
                    tmpAr[ "due_at" ] = tmpAssignments[j].due_at ;
                    tmpAr[ "unlock_at" ] = tmpAssignments[j].unlock_at ;
                    tmpAr[ "lock_at" ] = tmpAssignments[j].lock_at ;
                    */
    var fields = [
      'faculty',
      'course_code',
      'name',
      'subaccount_name',
      'total_students',
      "total_weight",
      'url'
    ];

    //titleAr to store title for access code

    var titleAr = [
      "faculty",
      'course_code',
      'name',
      'subaccount_name',
      'total_students',
      
      "total_weight",
      
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
              //var quote = false;
              var quote = true;
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
      //d = pad(1 + dt.getMonth()) + '/' + pad(dt.getDate()) + '/' + dt.getFullYear() +  ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());

      //d = ""+ pad(dt.getFullYear()-2000)+ '-' +  pad(1 + dt.getMonth())+ '-' +  pad(dt.getDate()) + ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
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
                  $('#quiz-submissions-report').one('click', {
                    type: 2
                  }, allCourseAssignmentReport0);
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

