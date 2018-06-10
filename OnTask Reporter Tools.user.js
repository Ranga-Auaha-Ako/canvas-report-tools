// ==UserScript==
// @name        OnTask Reporter Tools
// @author      Damon Ellis & WenChen Hol
// @namespace   https://github.com/damonkellis/canvascode/
// @description For Canvas users at the University of Auckland, this tool generates a .CSV download of the class list and access report for all students in a course
// @downloadURL https://github.com/damonkellis/canvascode/raw/master/SRESreport.user.js
// @include     https://*/courses/*/users
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @version     2.6.7
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
  today = dd + '-' + mm + '-' + yyyy;
  var aborted = false;
  addAccessReportButton();
  function addAccessReportButton() {
    /*
    if ($('#jj_student_report').length === 0) {
      $('#people-options > ul').append('<li class="ui-menu-item" role="presentation" tabindex="-1"><a id="jj_student_report" class="ui-corner-all" role="menuitem"><i class="icon-analytics"></i> SRES student list</a></li>');
      $('#jj_student_report').one('click', {
        type: 1
      }, accessReport);
    }
    if ($('#jj_access_report').length === 0) {
      $('#people-options > ul').append('<li class="ui-menu-item" role="presentation" tabindex="-2"><a id="jj_access_report" class="ui-corner-all" role="menuitem"><i class="icon-analytics"></i> SRES access data</a></li>');
      $('#jj_access_report').one('click', {
        type: 0
      }, accessReport);
    }
    */
    if ($('#jj_ontask_access_report').length === 0) {
      $('#people-options > ul').append('<li class="ui-menu-item" role="presentation" tabindex="-3"><a id="jj_ontask_access_report" class="ui-corner-all" role="menuitem"><i class="icon-analytics"></i> Access data pivot table format</a></li>');
      $('#jj_ontask_access_report').one('click', {
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
    var url = '/api/v1/courses/' + courseId + '/sections?include[]=students&include[]=email&per_page=100';
    progressbar();
    pending = 0;
    getStudents(courseId, url);
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
  function getStudents(courseId, url) { //cycles through the student list
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
                      var user = section.students[j];
                      user.section_id = section.id;
                      user.section_name = section.name;
                      user.sis_section_id = section.sis_section_id;
                      user.sis_course_id = section.sis_course_id;
                      var splitname = user.sortable_name.split(',');
                      user.firstname = splitname[1].trim();
                      user.surname = splitname[0].trim();
                      userData[user.id] = user;
                  } // end for
              } // end if length>0
          } catch(e){ continue; }
        }
        if (url) {
          getStudents(courseId, url);
        }
        pending--;
        if (pending <= 0) {
          if (reporttype == 0) { //branches to get student access data
            getAccessReport(courseId);
          }
          if (reporttype == 1) {
            makeReport();
          }
          if (reporttype == 2) {
            getAccessReport(courseId);
          }
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
        if (reporttype == 0) {
          saveAs(blob, 'course-' + courseId + '-access-report-' + today + '.csv');
          $('#jj_access_report').one('click', {
            type: 0
          }, accessReport);
        }
        if (reporttype == 1) {
          var savename = 'course-' + courseId + '-student-list-' + today + '.csv';
          saveAs(blob, savename);
          $('#jj_student_report').one('click', {
            type: 1
          }, accessReport);
        }
        if (reporttype == 2) {
          var ontask_savename = 'course-' + courseId + '-ontask-access-report-' + today + '.csv';
          saveAs(blob, ontask_savename);
          $('#jj_ontask_access_report').one('click', {
            type: 2
          }, accessReport);
        }
      } else {
        throw new Error('Problem creating report');
      }
    } catch (e) {
      errorHandler(e);
    }
  }
  function createCSV() {
    var fields = [
      {
        'name': 'Canvas User ID',
        'src': 'u.id'
      },
      {
        'name': 'UoA Username',
        'src': 'u.login_id',
        'sis': true
      },
      {
        'name': 'First name',
        'src': 'u.firstname'
      },
      {
        'name': 'Surname',
        'src': 'u.surname'
      },
      {
        'name': 'Email',
        'src': 'u.email'
      },
      {
        'name': 'Display Name',
        'src': 'u.name'
      },
      {
        'name': 'Sortable Name',
        'src': 'u.sortable_name'
      },
      {
        'name': 'Category',
        'src': 'a.asset_category',
        'accessing': true
      },
      {
        'name': 'Class',
        'src': 'a.asset_class_name',
        'accessing': true
      },
      {
        'name': 'Title',
        'src': 'a.readable_name',
        'accessing': true
      },
      {
        'name': 'Views by ' + today,
        'src': 'a.view_score',
        'accessing': true
      },
      {
        'name': 'Participations by ' + today,
        'src': 'a.participate_score',
        'accessing': true
      },
      {
        'name': 'Last Access',
        'src': 'a.last_access',
        'fmt': 'date',
        'accessing': true
      },
      {
        'name': 'First Access',
        'src': 'a.created_at',
        'fmt': 'date',
        'accessing': true
      },
      {
        'name': 'Action',
        'src': 'a.action_level',
        'accessing': true
      },
      {
        'name': 'Code',
        'src': 'a.asset_code',
        'accessing': true
      },
      {
        'name': 'Group Code',
        'src': 'a.asset_group_code',
        'accessing': true
      },
      {
        'name': 'Context Type',
        'src': 'a.context_type',
        'accessing': true
      },
      {
        'name': 'Context ID',
        'src': 'a.context_id',
        'accessing': true
      },
      {
        'name': 'SIS Login ID',
        'src': 'u.sis_login_id'
      },
      {
        'name': 'Section',
        'src': 'u.section_name',
      },
      {
        'name': 'Section ID',
        'src': 'u.section_id',
      },
      {
        'name': 'SIS Course ID',
        'src': 'u.sis_course_id',
        'sis': true
      },
      {
        'name': 'SIS Section ID',
        'src': 'u.sis_section_id',
        'sis': true
      },
      {
        'name': 'SIS User ID',
        'src': 'u.sis_user_id',
        'sis': true
      }
    ];
    var canSIS = false;
    for (var id in userData) {
      if (userData.hasOwnProperty(id)) {
        if (typeof userData[id].sis_user_id !== 'undefined' && userData[id].sis_user_id) {
          canSIS = true;
          break;
        }
      }
    }
    var CRLF = '\r\n';
    var hdr = [
    ];
    fields.map(function (e) {
      if (typeof e.sis === 'undefined' || (e.sis && canSIS)) {
        if (typeof e.accessing === 'undefined' || e.accessing && reporttype == 0) {
          hdr.push(e.name);
        }
      }
    });
    var t = hdr.join(',') + CRLF;
    var item,
    user,
    userId,
    fieldInfo,
    value;
    if (reporttype == 0) {
      for (var i = 0; i < accessData.length; i++) {
        item = accessData[i].asset_user_access;
        userId = item.user_id;
        user = userData[userId];
        for (var j = 0; j < fields.length; j++) {
          if (typeof fields[j].sis !== 'undefined' && fields[j].sis && !canSIS) {
            continue;
          }
          fieldInfo = fields[j].src.split('.');
          value = fieldInfo[0] == 'a' ? item[fieldInfo[1]] : user[fieldInfo[1]];
          if (value === null) {
            value = '';
          } else {
            if (typeof fields[j].fmt !== 'undefined') {
              switch (fields[j].fmt) {
                case 'date':
                  value = excelDate(value);
                  break;
                default:
                  break;
              }
            }
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
    }
    if (reporttype == 1) {
      for (var id in userData) {
        item = userData[id];
        userId = item.id;
        user = userData[userId];
        for (var j = 0; j < fields.length; j++) {
          if (typeof fields[j].sis !== 'undefined' && fields[j].sis && !canSIS) {
            continue;
          }
          if (typeof fields[j].accessing !== 'undefined' && fields[j].accessing) {
            continue;
          }
          fieldInfo = fields[j].src.split('.');
          value = fieldInfo[0] == 'a' ? item[fieldInfo[1]] : user[fieldInfo[1]];
          if (value === null) {
            value = '';
          } else {
            if (typeof fields[j].fmt !== 'undefined') {
              switch (fields[j].fmt) {
                case 'date':
                  value = excelDate(value);
                  break;
                default:
                  break;
              }
            }
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
    }
    return t;
  }
//////////////////////////
function createOntaskCSV() {
    var fields = [
      'id',
      'login_id',
      'firstname',
      'surname',
      'email',
      'name',
      'sortable_name'
    ];

    //titleAr to store title for access code

    var titleAr = [
        'Canvas_User_ID',
        'Username',
        'First_name',
        'Surname',
        'Email',
        'Display_Name',
        'Sortable_Name'
    ];
    var ontaskReportAr=[];
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
    //loop through userData
    for (var id in userData) {
        //tmpUpi = userData[id].login_id;
        //tmpAr = [] ;
        ontaskReportAr[id] = [];
        ontaskReportAr[id]['id'] = userData[id].id;
        ontaskReportAr[id]['login_id'] = userData[id].login_id;
        ontaskReportAr[id]['firstname'] = userData[id].firstname;
        ontaskReportAr[id]['surname'] = userData[id].surname;
        ontaskReportAr[id]['email'] = userData[id].email;
        ontaskReportAr[id]['name'] = userData[id].name;
        ontaskReportAr[id]['sortable_name'] = userData[id].sortable_name;

    }

    //loop through accessData to save in ontaskReport
     for (var i = 0; i < accessData.length; i++) {
        //get code
        item = accessData[i].asset_user_access;
        tmpCode = item.asset_code;
        tmpId = item.user_id;
 // if (debug) { console.log(tmpCode); }
 // if (debug) { console.log(tmpId); }
        //if code not exist in fields, add views/participations/lastaccess,firstacces/group/section fields
        if ( fields.indexOf( tmpCode + "_views" ) <0 ) {
            fields.push( tmpCode + "_views" ) ;
            fields.push( tmpCode + "_participations" );
            //fields.push( tmpCode + "_lastaccess" );
            //fields.push( tmpCode + "_firstaccess" );
            //fields.push( tmpCode + "_group" );
            //fields.push( tmpCode + "-section" );
            tmpTitle = item.readable_name;
            tmpTitle = tmpTitle.replace(punctRE, '').replace(spaceRE, '_');
            //tmpTitle = tmpTitle.replace(/[^\w\s]/gi, '').replace(spaceRE, '_');

            //console.log( tmpTitle );
            if ( tmpTitle.length >40 ) {
                tmpTitle = tmpTitle.substr(0,40);
            }
            if ( (titleAr.indexOf( tmpTitle + "_views" )>-1) || (titleAr.indexOf( tmpTitle + "_participate" ) >-1) ){
                tmpTitle = tmpTitle + "" + item.id + "_";
            }

            titleAr.push( tmpTitle + "_views" ) ;
            titleAr.push( tmpTitle + "_participate" );
            //titleAr.push( tmpTitle + "_lastaccess" );
            //titleAr.push( tmpTitle + "_firstaccess" );
            //titleAr.push( tmpTitle + "_group" );
            //titleAr.push = accessData[i].readable_name;
        }
        ontaskReportAr[tmpId][tmpCode + "_views"] = 0 ;
        ontaskReportAr[tmpId][tmpCode + "_participate"]= 0 ;
        //ontaskReportAr[tmpId][tmpCode + "_lastaccess"] = "";
        //ontaskReportAr[tmpId][tmpCode + "_firstaccess"] = "";
        //ontaskReportAr[tmpId][tmpCode + "_group"] = "";
        //record data into ontaskReport
        try {
            if ( item.view_score !== null ) {
                ontaskReportAr[tmpId][tmpCode + "_views"] = item.view_score ;
            }
            if ( item.participate_score!== null ) {
                ontaskReportAr[tmpId][tmpCode + "_participations"]= item.participate_score ;
            }
           /* if ( item.last_access !== null ) {
                ontaskReportAr[tmpId][tmpCode + "_lastaccess"]= excelDate( item.last_access );
            }
            if ( item.created_at !== null ) {
                ontaskReportAr[tmpId][tmpCode + "_firstaccess"]= excelDate( item.created_at );
            }

            if ( item.asset_group_code!== null ) {
                ontaskReportAr[tmpId][tmpCode + "_group"]= item.asset_group_code;
            }*/
        } catch(e){}


    } // end for

    var CRLF = '\r\n';


    var t = titleAr.join(',') + CRLF;//csv first line

//if (debug) { console.log( ontaskReportAr); }
      //for (var item in ontaskReportAr) {
      for (var id in userData) {
        user = userData[id];
        userId = user.id;
        item = ontaskReportAr[userId];
       // if (debug) { console.log( userId, item ); }

        for (var j = 0; j < fields.length; j++) {
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

