// ==UserScript==
// @name        Course Activity Report
// @author      Damon Ellis/WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description For Canvas users at the University of Auckland, this tool generates a .CSV download of the class list and access report for all students in a course
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/canvas-activity.user.js
// @include     https://*/courses/*/users
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @version     0.21
// @grant       none
// ==/UserScript==

// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement


(function () {
  'use strict';
  var userData = {
  };
  var accessData = [
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
  //today = dd + '-' + mm + '-' + yyyy;
  today = (yyyy-2000 ) + '-' + mm + '-' + dd  + '-' + Math.floor(Date.now() /1000) ;
  var aborted = false;
  addAccessReportButton();
  function addAccessReportButton() {
   
    if ($('#jj_course_access_report').length === 0) {
      $('#people-options > ul').append('<li class="ui-menu-item" role="presentation" tabindex="-3"><a id="jj_course_access_report" class="ui-corner-all" role="menuitem"><i class="icon-analytics"></i> Course activity report</a></li>');
      $('#jj_course_access_report').one('click', {
        type: 2
      }, accessReport);
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
  function accessReport(e) { //gets the student list
    reporttype = e.data.type;
    aborted = false;
    setupPool();
    var courseId = getCourseId();
    console.log( {courseId} );
    //var url = '/api/v1/courses/' + courseId + '/sections?include[]=students&include[]=email&per_page=100';
    var url = '/api/v1/courses/' + courseId + '/sections?include[]=students&include[]=email&per_page=50';
    //console.log( ' First url:', url );
    //var url = '/api/v1/courses/' + courseId + '/users?include_inactive=true&include%5B%5D=enrollments&include%5B%5D=email&include%5B%5D=observed_users&include%5B%5D=can_be_removed&per_page=100';

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
        if (debug) console.log( "number ss:", studentIdAr.length );
        if (url) {
          getStudents( url, courseId );
        }
        pending--;
        if (debug) console.log( "pending:", pending );

        if (pending <= 0) {

          getAccessReport(courseId);

        }
      }).fail(function () {
        pending--;
        throw new Error('Failed to load list of students');
      });
    } catch (e) {
      errorHandler(e);
    }
  }

  function getAccessReport(courseId) { //cycles through student list
    pending = 0;
    fetched = 0;
    needsFetched = Object.getOwnPropertyNames(userData).length;
    for (var id in userData) {
      if (userData.hasOwnProperty(id)) {
        var url = '/courses/' + courseId + '/users/' + id + '/usage.json?per_page=100';
        getAccesses(courseId, url);
      }
    }
  }

  function getAccesses(courseId, url) { //gets usage data for each student individually
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      pending++;
      $.getJSON(url, function (adata, status, jqXHR) {
        url = nextURL(jqXHR.getResponseHeader('Link'));
        accessData.push.apply(accessData, adata);
        if (url) {
          getAccesses(courseId, url);
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
      courseTitle = document.title.split( "Course roster:" )[1].replace(/[^\w]/g, "");
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
      if (reporttype!=2){
        csv = createCSV();
      } else {
        csv = createOntaskCSV();
      }
      if (csv) {
        var courseId = getCourseId();
        var blob = new Blob([csv], {
          'type': 'text/csv;charset=utf-8'
        });
      
          var savename = courseTitle + '-course-activity-report-' + today + '.csv';
          saveAs(blob, savename);
          $('#jj_course_access_report').one('click', {
            type: 2
          }, accessReport);
        
      } else {
        throw new Error('Problem creating report');
      }
    } catch (e) {
      errorHandler(e);
    }
  }

//////////////////////////
function createOntaskCSV() {
    var fields = [
      'id',
      'sis_user_id',
      'login_id',
      'name',
      'sectionName',
      'contentType',
      'contentName',
      'views',
      'participations',
      'startDate',
      'firstAccess',
      'lastAccess'
    ];

    //titleAr to store title for access code

    var titleAr = [
        'Canvas_User_ID',
        'AUID',
        'Username',
        'Student_Name',
        'Section_Name',
        'Content_Type',
        'Content_Name',
        'views',
        'participations',
        'Start Date',
        'First Access',
        'Last Access'
    ];
    var courseActivityAr=[];
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
    //loop through userData
    /* for (var id in userData) {

        courseActivityAr[id] = [];
        courseActivityAr[id]['id'] = userData[id].id;
        courseActivityAr[id]['sis_user_id'] = userData[id].sis_user_id;
        courseActivityAr[id]['login_id'] = userData[id].login_id;
  
        courseActivityAr[id]['name'] = userData[id].name;
        courseActivityAr[id]['sectionName'] = userData[id].sectionName;

    } */

    //loop through accessData to save in ontaskReport
     for (var i = 0; i < accessData.length; i++) {
        courseActivityAr[i] = [];
        

        //get code
        item = accessData[i].asset_user_access;
        //try to exclude student profile access
        try {
          if ( item.asset_category=="roster" ) {
            continue;
          }
        } catch(e){}
        //asset_class_name
        //display_name
        tmpCode = item.asset_code;
        tmpId = item.user_id;
        courseActivityAr[i]["views"] = 0 ;
        courseActivityAr[i]["participations"]= 0 ;
        courseActivityAr[i]["startDate"] = "";
        courseActivityAr[i]["lastAccess"] = "";
        courseActivityAr[i]["firstAccess"] = "";
       
        courseActivityAr[i]['id'] = userData[tmpId].id;
        courseActivityAr[i]['sis_user_id'] = userData[tmpId].sis_user_id;
        courseActivityAr[i]['login_id'] = userData[tmpId].login_id;
  
        courseActivityAr[i]['name'] = userData[tmpId].name;
        courseActivityAr[i]['sectionName'] = userData[tmpId].sectionName;
        //courseActivityAr[tmpId][tmpCode + "_group"] = "";
        //record data into ontaskReport
        try {
            if ( item.view_score !== null ) {
                courseActivityAr[i]["views"] = item.view_score ;
            }
            if ( item.participate_score!== null ) {
                courseActivityAr[i]["participations"]= item.participate_score ;
            }
            if ( item.last_access !== null ) {
                courseActivityAr[i]["lastAccess"]= excelDate( item.last_access );
            }
            if ( item.created_at !== null ) {
                courseActivityAr[i]["firstAccess"]= excelDate( item.created_at );
                courseActivityAr[i]["startDate"] = courseActivityAr[i]["firstAccess"].split(' ')[0];
            }
            courseActivityAr[i]["contentType"] = item.asset_class_name;
            courseActivityAr[i]["contentName"] = item.readable_name;
            //if ( item.asset_group_code!== null ) {
            //    courseActivityAr[tmpId][tmpCode + "_group"]= item.asset_group_code;
           // }
        } catch(e){}


    } // end for

    var CRLF = '\r\n';


    var t = titleAr.join(',').toLowerCase() + CRLF;//csv first line

//if (debug) { console.log( courseActivityAr); }
      //for (var item in courseActivityAr) {
      for (let i=0;i<courseActivityAr.length;i++) {
        
        if ( !courseActivityAr[i]['id'] ){
          continue;
        }
        if ( courseActivityAr[i]["contentType"]=="attachment" ) {
          
          let ext = courseActivityAr[i]["contentName"].substr( courseActivityAr[i]["contentName"].lastIndexOf('.') + 1);
          console.log(ext);
          if ( imageAr.includes( ext.toLowerCase() ) ){
            continue;
          }
        }
        item = courseActivityAr[i];
       // if (debug) { console.log( userId, item ); }

        for (let j = 0; j < fields.length; j++) {
          tmpFieldName = fields[j];
          //if (debug) { console.log(tmpFieldName); }
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
                 
                    $('#jj_course_access_report').one('click', {
                      type: 2
                    }, accessReport);


                 
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

