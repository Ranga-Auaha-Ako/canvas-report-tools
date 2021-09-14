// ==UserScript==
// @name        Course Progress Report
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description For Canvas users at the University of Auckland, this tool generates a .CSV download of the class list and access report for all students in a course
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/course-progress.user.js
// @include     https://*/courses/*/modules
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
  var progressData = [
  ];
  var courseActivityAr = {};
  var modules = [];
  var pending = - 1;
  var fetched = 0;
  var needsFetched = 0;
  var reporttype;
  var ajaxPool;
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();
  //var courseId;
  var debug = 0;
  var debugProgress = 0;
  var debugReport = 0;
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (mm < 10) {
    mm = '0' + mm;
  }
  //today = dd + '-' + mm + '-' + yyyy;
  today = (yyyy-2000 ) + '-' + mm + '-' + dd  + '-' + Math.floor(Date.now() /1000) ;
  var aborted = false;
  addProgressReportButton();
  function addProgressReportButton() {
   
    if ($('#jj_course_progress_report').length === 0) {
      $('.header-bar-right__buttons').prepend('<button id="jj_course_progress_report" class="btn" role="menuitem"><i class="icon-analytics"></i> Course progress report</button>');
      $('#jj_course_progress_report').one('click', {
        type: 2
      }, progressReport);
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
  function progressReport(e) { //gets the student list
    reporttype = e.data.type;
    aborted = false;
    setupPool();
    var courseId = getCourseId();
    console.log( {courseId} );
    
    var url = '/api/v1/courses/' + courseId + '/sections?include[]=students&include[]=email&per_page=50';
    progressbar();
    pending = 0;
    getStudents( url, courseId );
    //getPeople(courseId, url);
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

  
  function getStudents( url, courseId ) { //cycles through the student list
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      jQuery("#doing").html( "Fetching student informaton <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
      pending++;
      $.getJSON(url, function (udata, status, jqXHR) {
        url = nextURL(jqXHR.getResponseHeader('Link'));
        //console.log("nextUrl", url);
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
                      user.sectionName = section.name;
                      userData[user.id] = user;
                      
                  } // end for
              } // end if length>0
          } catch(e){ continue; }
        }
        if (debug) console.log( "next url ?", url );
        if (url) {
          getStudents( url, courseId );
        }
        pending--;
        if (debug) console.log( "pending:", pending );

        if (pending <= 0) {

          getprogressReport(courseId);

        }
      }).fail(function () {
        pending--;
        throw new Error('Failed to load list of students');
      });
    } catch (e) {
      errorHandler(e);
    }
  }

  function getprogressReport(courseId) { //cycles through student list
    pending = 0;
    fetched = 0;
    needsFetched = Object.getOwnPropertyNames(userData).length;
    var moduleUrl = '/api/v1/courses/'+ courseId + '/modules?per_page=30';
    getModules( courseId, moduleUrl );
    
    
  }

  function getModules ( courseId, url ) { //cycles through student list
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
            getModules( courseId, url );
        }
        pending--;
        if (pending <= 0) {
            if (debug) console.log( modules );
            if (debug) console.log( "number of modules:", modules.length );
            
            var progressUrl = '/courses/' + courseId + '/modules/progressions.json';
            getProgresses(progressUrl);

        }
    } );
  }
  function getProgresses(url) { //gets usage data for each student individually
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      pending++;
      $.getJSON(url, function (adata, status, jqXHR) {
        url = nextURL(jqXHR.getResponseHeader('Link'));
        //array of {"context_module_progression":{"id":13041449,"current":true,"evaluated_at":"2021-07-27T11:03:18+12:00","context_module_id":169490,"user_id":301259,"requirements_met":[],"workflow_state":"unlocked","created_at":"2021-07-19T22:19:12+12:00","updated_at":"2021-07-27T11:03:18+12:00","collapsed":null,"current_position":null,"completed_at":null,"lock_version":3,"incomplete_requirements":[],"root_account_id":1}}
        //context_module_progression:
        progressData.push.apply(progressData, adata);
        if (url) {
          getProgresses(url);
        }
        pending--;
        fetched++;
        progressbar(fetched, needsFetched);
        if (pending <= 0 && !aborted) {
          makeReport();
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

  function makeReport() { //generates CSV of data
    var csv;
    var courseTitle = '';
    try{
      courseTitle = document.title.split( "Course Modules:" )[1].split(":")[0].replace(/[^\w]/g, "");
    }catch(e){
      courseTitle = courseId; 
    }
    
    try {
      if (aborted) {
        console.log('Process aborted');
        aborted = false;
        return;
      }
      progressbar();
      csv = createProgressCSV();
      //loop through progressData
      if (csv) {
        var courseId = getCourseId();
        var blob = new Blob([csv], {
          'type': 'text/csv;charset=utf-8'
        });
      
          var savename = courseTitle + '-course-progress-report-' + today + '.csv';
          saveAs(blob, savename);
          $('#jj_course_progress_report').one('click', {
            type: 2
          }, progressReport);
        
      } else {
        throw new Error('Problem creating report');
      }
    } catch (e) {
      errorHandler(e);
    }
    
  }

//////////////////////////
function createProgressCSV() {
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
        'Student_Name'

    ];
    
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
    var tmpTitle;
    var punctRE = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-\.\/:;<=>?@\[\]^_`{|}~]/g;
    var spaceRE = /\s+/g;
    var imageAr = [ "png", "jpg", "gif", "jpeg" ];
 
    //add modules into fields, titleAr
    for ( let m=0;m<modules.length;m++){
        let tmpModule = modules[m];
        if ( tmpModule.published ){
            fields.push( tmpModule.id );
            titleAr.push( tmpModule.name );
        }

    }
    if (debug) console.log({fields});
   //loop through userData
   for (var id in userData) {
        let tmpId = id.toString();
        courseActivityAr[tmpId] = {};
        courseActivityAr[tmpId]['id'] = userData[id].id;
        courseActivityAr[tmpId]['sis_user_id'] = userData[id].sis_user_id;
        courseActivityAr[tmpId]['login_id'] = userData[id].login_id;
        courseActivityAr[tmpId]['name'] = userData[id].name;
        for ( let m=0;m<modules.length;m++){
            let tmpModuleId = (modules[m].id).toString();
            courseActivityAr[tmpId][tmpModuleId] = "";
        }

   } 
   if (debug) console.log({courseActivityAr});
    //loop through progressData to save in ontaskReport
     for (var i = 0; i < progressData.length; i++) {
        //console.log( progressData[i] );
        //get code
        let item = progressData[i].context_module_progression;
        
        //asset_class_name
        //display_name
        let moduleId = (item.context_module_id).toString();
        let workflow_state = item.workflow_state;
        let tmpUserId = (item.user_id).toString(); // canvas user id
        if (debugReport){
            console.log( moduleId, tmpUserId, workflow_state );
        }
        try{ 
            courseActivityAr[tmpUserId][moduleId] = workflow_state ;
        }catch(e){}
        

    } // end for
    if (debugReport) console.log({courseActivityAr});
    var CRLF = '\r\n';


    var t = titleAr.join(',').toLowerCase() + CRLF;//csv first line

//if (debug) { console.log( courseActivityAr); }
    for (var item in courseActivityAr) {
       //if (debugReport) console.log( {item} );
        let tmpActivity = courseActivityAr[item];
        if (debugReport) console.log( tmpActivity );

        for (let j = 0; j < fields.length; j++) {
          tmpFieldName = fields[j].toString();
          //if (debug) { console.log(tmpFieldName); }
          value = tmpActivity[ tmpFieldName ];
          if (debugReport){ console.log( tmpFieldName, value ) }
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
                 
                    $('#jj_course_progress_report').one('click', {
                      type: 2
                    }, progressReport);


                 
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

