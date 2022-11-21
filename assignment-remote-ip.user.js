// ==UserScript==
// @name        Canvas assignment time student remote ip address information download
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description For Canvas users, this tool generates a .CSV download of student remote ip address during assignment time
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/quiz-submissions-allattempts.user.js
// @include     https://*/courses/*/assignments/*
// @include     https://*/courses/*/quizzes/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @version     0.4
// @grant       none
// ==/UserScript==

// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement
// sample page_view API /api/v1/users/ssid/page_views?start_time=1%20Jun&end_time=1%20Jul
(function () {
  'use strict';
  var userData = {
  };
  //

  //
  var studentIdAr = [
  ]; // quiz_submissions is array of objects
  var attemptAr = new Object(); //attemptAr is array of objects
  var pending = - 1;
  var fetched = 0;
  var needsFetched = 0;
  var reporttype;
  var ajaxPool;
  var courseId;
  var quizId;
  var sIndex;
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();
  var t1;
  var t2;
  var debug = 0;
  var maxAtmps=0;
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (mm < 10) {
    mm = '0' + mm;
  }
  //courseId = getCourseId();
  var timeRange = getTimeRange();

  today = (yyyy-2000 ) + '-' + mm  + '-' + dd + '-' + Math.floor(Date.now() /1000) ;
  var aborted = false;
  addAssignmentRemoteIpButton();

  function addAssignmentRemoteIpButton() {

    //https://canvas.auckland.ac.nz:443/api/v1/courses/29897/quizzes/25662/submissions?include[]=user
      //try {

        if ($('#remote-ip-report').length === 0) {
          //if  ( $('.page-action-list') ) {
          //   $('.page-action-list').append(
          //      '<li><a href="javascript:void(0)" id="remote-ip-report" class="ui-corner-all" role="menuitem"><i class="icon-analytics"></i> Student remote ip information Download</a></li>'
          //      );
          //} else {
            $('#sidebar_content').append(
                '<span><a href="javascript:void(0)" id="remote-ip-report" class="ui-corner-all" role="menuitem"><i class="icon-analytics"></i> Student remote ip information Download</a></span>'
                );

          //}


          $('#remote-ip-report').one('click', {
            type: 2
          }, remoteIpReport);
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

  function remoteIpReport(e) { //gets the student list
    pending = 0;
    fetched = 0;
    reporttype = e.data.type;
    aborted = false;
    setupPool();
    courseId = getCourseId();
    //quizId = getQuizId();
    if (debug) console.log( courseId );
    var url = '/api/v1/courses/' + courseId + '/sections?include[]=students&include[]=email&per_page=50';
    progressbar();
    pending = 0;
    getStudents( url, courseId );

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

                      user.remote_ip = [];
                      userData[user.id] = user;
                      studentIdAr.push( user.id );
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

            getRemoteIpReport( );

        }
      }).fail(function () {
        pending--;
        throw new Error('Failed to load list of students');
      });
    } catch (e) {
      errorHandler(e);
    }
  }

  function getRemoteIpReport() { //cycles through student list
    pending = 0;
    fetched = 0;
    t1='';
    t2='';
    needsFetched = Object.getOwnPropertyNames(userData).length;
    if (debug) console.log( "needsFetched:", needsFetched );
    if ( timeRange.length>0 ){
        for ( let i=0;i<timeRange.length;i++){
            let tmpT = timeRange[i];
            if (debug) console.log( tmpT );
            if ( t1=='' ){
                t1=tmpT;
            } else {
                if ( Date.parse( t1 ) > Date.parse( tmpT ) ){
                    //t2 = t1;
                    t1 = tmpT;
                }
            }
            if (t2==''){
                t2=tmpT;
            } else {
                if ( Date.parse( tmpT ) > Date.parse( t2 ) ){
                    //t2 = t1;
                    t2 = tmpT;
                }
            }
        }
    }
    if (debug) console.log( t1, t2 );
    if (t1==t2){
      t2 = t2 + " 23:59";
    }
    sIndex = 0;
    jQuery("#doing").html( "Fetching Student remote ip information <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
    getStudentIp( );


  }

  function getStudentIp( ){

    let studentId = studentIdAr[ sIndex ];
    let url = `/api/v1/users/${studentId}/page_views?start_time=${t1}&end_time=${t2}&per_page=100`;
    if (debug) console.log( "getStudentIp url:", url );
    getRemoteIp( url );
  }

  function getRemoteIp( ssPageViewUrl ) { //get peer review data
    let studentId = '';
    if ( t1=="" && t2=="" ) {
        console.log( "time range empty!!" );
        return;
    }
    if (debug) console.log( 'in getRemoteIp sIndex:', sIndex );
    if ( sIndex < studentIdAr.length ){
        studentId = studentIdAr[ sIndex ];
        try {
            if (aborted) {
              throw new Error('Aborted');
            }
            pending++;
            progressbar(fetched, needsFetched);
            $.getJSON(ssPageViewUrl, function (adata, status, jqXHR) {
              let tmpPageViewAr = adata;

              let url = nextURL(jqXHR.getResponseHeader('Link'));
              //store remote ip address to student user object
              for ( let i=0; i< tmpPageViewAr.length;i++ ){
                if  ( tmpPageViewAr[i].remote_ip  ){
                    //if ( ! ( userData[ studentId ].remote_ip.includes( tmpPageViewAr[i].remote_ip  ) ) ) {
                        userData[ studentId ].remote_ip.push( tmpPageViewAr[i].remote_ip  );
                        if (debug) console.log( "studentId, remoteIp:", studentId, tmpPageViewAr[i].remote_ip );
                    //}
                }

              }

              if (url) {
                getRemoteIp( url );
              } else {
                sIndex+=1;
                fetched+=1;
                progressbar(fetched, needsFetched);

                if (debug) console.log( "sIndex:", sIndex  );
                if (sIndex < studentIdAr.length && !aborted) {
                    getStudentIp( );
                } else {
                    //get net student ip
                    makeReport( courseId );
                }
              }
            }).fail(function () {
              sIndex+=1;
              fetched+=1;
              //get next student ip
              getStudentIp(  );
              progressbar(fetched, needsFetched);
              if (!aborted) {
                console.log('Some report data failed to load');
              }
            });
        } catch (e) {
            errorHandler(e);
        }
    } else {
        //generate the report
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

  function getTimeRange() {
    let timeRange = [];
    let a="";
    if (debug) console.log( "in timeRange:" );

    //try {
    if ( jQuery('.assignment_dates') ){
        jQuery('.assignment_dates td').each(
            function(){
                a=jQuery(this).attr('data-html-tooltip-title');
                if ( a ){
                    if (debug) console.log( a );

                    let tmpAr = a.split( ' ' );
                    let dateStr = tmpAr[0] + ' ' + tmpAr[1];
                    timeRange.push( dateStr );
                }
            } );
        }
        if ( jQuery('#quiz_student_details') ) {
            jQuery('#quiz_student_details .value').each(
                function(){
                    a=jQuery(this).text();
                    if ( a.indexOf(' - ') >0 ){
                        if (debug) console.log( a );

                        let tmpAr = a.split( ' - ' );
                        if ( tmpAr[0].indexOf( ' at ' ) >0 ) {
                            //let dateStr1 = tmpAr[0].split(' at')[0];
                            let dateStr1 = tmpAr[0].replace( / at /, ' ' );
                            timeRange.push( dateStr1.trim() );
                        }
                        if ( (tmpAr.length >1) &&  (tmpAr[1].indexOf( ' at' ) >0) ){
                            //let dateStr2 = tmpAr[1].split(' at')[0];
                            let dateStr2 = tmpAr[1].split(/\r?\n/)[0].replace( / at /, ' ' );
                            timeRange.push( dateStr2.trim() );
                        }
                    }
                } );

        }
    //} catch (e) {
   ////   errorHandler(e);
    //}
    if (debug) console.log({timeRange});
    return timeRange;
  }


  function makeReport( courseId) { //generates CSV of data
    var csv;
    var quizTitle="";
    try {
        quizTitle = jQuery('span.ellipsible')[1].innerHTML.replace(/[^\w]/g, "");
        //quizTitle=document.title.split( ":" )[0].replace(/[^\w]/g, "");
    } catch(e){
      quizTitle=document.title.split( ":" )[0].replace(/[^\w]/g, "");
    }

    try {
      if (aborted) {
        console.log('Process aborted');
        aborted = false;
        return;
      }
      progressbar();

       csv = createRemoteIpCSV();

      if (csv) {
        var blob = new Blob([csv], {
          'type': 'text/csv;charset=utf-8'
        });

        var savename = 'course-' + courseId + '-remoteIp-' + quizTitle + '-' + today + '.csv';
          saveAs(blob, savename);
          $('#remote-ip-report').one('click', {
            type: 2
          }, remoteIpReport);
          resetData();

      } else {
        throw new Error('Problem creating report');
      }
    } catch (e) {
      errorHandler(e);
    }
  }

//////////////////////////
function createRemoteIpCSV() {

    var fields = [
      'id',
      'sis_user_id',
      'login_id',
      'name',
      'email',
      'remote_ip'
    ];

    //titleAr to store title for access code

    var titleAr = [
        'Canvas_User_ID',
        'AUID',
        'Username',
        'Display_Name',
        'Email',
        "Remote_Ip"
    ];

    var remoteIpReportAr=[];
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
        remoteIpReportAr[id] = [];
        remoteIpReportAr[id]['id'] = userData[id].id;
        remoteIpReportAr[id]['sis_user_id'] = userData[id].sis_user_id;
        remoteIpReportAr[id]['login_id'] = userData[id].login_id;
        remoteIpReportAr[id]['name'] = userData[id].name;
        remoteIpReportAr[id]['email'] = userData[id].email;
        let tmpIpAr = userData[id].remote_ip;
        tmpIpAr = [...new Set(tmpIpAr)].sort() ;
        userData[id].remote_ip = tmpIpAr;
        remoteIpReportAr[id]['remote_ip'] = userData[id].remote_ip.toString();
    }




    if (debug) console.log( "remoteIp reportAr:", remoteIpReportAr );
    var CRLF = '\r\n';


    var t = titleAr.join(',').toLowerCase() + CRLF;//csv first line

//if (debug) { console.log( remoteIpReportAr); }
      //for (var item in remoteIpReportAr) {
      for (var id in userData) {
        user = userData[id];
        userId = user.id;

        item = remoteIpReportAr[userId];
       // if (debug) { console.log( userId, item ); }
       if (debug) console.log( item );
        for (var j = 0; j < fields.length; j++) {
          tmpFieldName = fields[j];
          value = item[ tmpFieldName ];
          //if (1) { console.log( "fieldName",tmpFieldName, value ); }

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
          $('#jj_progress_dialog').append('<div id="jj_progressbar"></div><small>It may take a while for large courses</small><br><small id="doing"></small>');
          $('#jj_progress_dialog').dialog({
            'title': 'Fetching Report',
            'autoOpen': false,
            'buttons': [
              {
                'text': 'Cancel',
                'click': function () {
                  $('#quiz-submissions-report').one('click', {
                    type: 2
                  }, remoteIpReport);
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
    studentIdAr = [];
    attemptAr = new Object();
    pending = - 1;
    fetched = 0;
    needsFetched = 0;
  }

  function errorHandler(e) {
    console.log(e.name + ': ' + e.message);
  }
}) ();

