// ==UserScript==
// @name        Show Assignment Override Names
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description Show assignment override infromation with student names
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/assignment-override-name.user.js
// @include     /^https://.*/courses/[0-9]+/(assignments|quizzes|discussion_topics)/[0-9]+(\?|$)/
// @version     0.2
// @grant       none
// ==/UserScript==
// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement
(function() {
  'use strict';
  // Change studentRegex for international support
  var studentRegex = new RegExp('^([0-9]+) student');
  var pending = -1;
  var userData = {};
  var overrides = [];
  var sections = {};
  var tableSelector = 'table.assignment_dates';
  var debug = 0;
  check_page();

  function check_page() {
    var urlRegex = new RegExp('/courses/([0-9]+)/(assignments|quizzes|discussion_topics)/([0-9]+)');
    var matches = urlRegex.exec(window.location.href);
    if (!matches) {
      return;
    }
    var courseId = matches[1];
    var assignmentType = matches[2];
    var assignmentId = matches[3];
    let overrideHtml = '<div id="override">Fetching override student information <img src=\'https://flexiblelearning.auckland.ac.nz/images/spinner.gif\'/></div>';
    if (debug) console.log( courseId, assignmentType, assignmentId );
    if (assignmentType == 'discussion_topics') {
      tableSelector = 'table.discussion-topic-due-dates';
    }
    //some quiz did not show the table ...
    //if ($(tableSelector)
    //  .length === 0) {
    //  return;
    //}
    //var isBeneficial = false;
  
    if ($(tableSelector).length ) {
      jQuery(overrideHtml).insertAfter(tableSelector);
    } else {
      jQuery( '#content' ).append(overrideHtml);
    }
    if (assignmentType === 'assignments') {
      getAssignment(courseId, assignmentId);
    } else {
      var url = '/api/v1/courses/' + courseId + '/' + assignmentType + '/' + assignmentId;
      getAssignmentId(courseId, url);
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

  function getAssignmentId(courseId, url) {
    $.getJSON(url, function(data, status, jqXHR) {
      var assignmentId = data.assignment_id;
      getAssignment(courseId, assignmentId);
    });
  }

  function getAssignment(courseId, assignmentId) {
    var url = '/api/v1/courses/' + courseId + '/assignments/' + assignmentId + '/overrides?per_page=100';
    pending = 0;
    getAssignmentOverrides(courseId, url);
  }

  function getAssignmentOverrides(courseId, url) {
    pending++;
    $.getJSON(url, function(data, status, jqXHR) {
      url = nextURL(jqXHR.getResponseHeader('Link'));
      for (var i = 0; i < data.length; i++) {
        overrides.push(data[i]);

      }
      if (url) {
        getAssignmentOverrides(courseId, url);
      }
      pending--;
      if (pending <= 0 && overrides.length>0) {
        getUsers(courseId);
      } else {
        $('#override').html( '' );
      }
    });
  }

  function getUsers(courseId) {
    
    if ( debug ) console.log('in getUsers');
    var chunkSize = 50;
    var chunk;
    var url;
    var i = 0;
    //var n = userList.length;
    pending = 0;
    url = '/api/v1/courses/' + courseId + '/sections?include[]=students&per_page=100';
    
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

        if (pending <= 0 && overrides.length>0) {

            myProcess( );

        } else{}
      }).fail(function () {
        pending--;
        throw new Error('Failed to load list of students');
      });
    } catch (e) {
      errorHandler(e);
    }
  }
  function getOverrideStr( due, forStr, from, til ){
    let trStr = `
    <tr>
      <td data-html-tooltip-title="">${due}</td>
      <td>${forStr}</td>
      <td data-html-tooltip-title="">${from}</td>
      <td data-html-tooltip-title="">${til}</td>
    </tr>`;
    if (debug) console.log( 'getOverrideStr:', trStr );
    return trStr;
  }
  function myProcess(){
      //redraw the table 
      let newTable =  `
      <br>
      <table id="overrideTable" class="ic-Table assignment_dates">
      <caption>Override information</caption>
      <thead>
      <tr>
        <th scope="col">Due</th>
        <th scope="col">For</th>
        <th scope="col">Available from</th>
        <th scope="col">Until</th>
      </tr>
    </thead>`;
        let forStr = '';
        let due = '';
        let from = '';
        let til = '';
        for ( let i=0;i<overrides.length;i++ ){
            forStr = '';
            due = '';
            from = '';
            til = '';
            if (typeof overrides[i].student_ids !== 'undefined'){
                let student_ids = overrides[i].student_ids;
                for (let j = 0; j <student_ids.length; j++) {
                    forStr += userData[ student_ids[ j ] ].name + ",";
                }
                forStr = forStr.slice(0, -1);
            } else {
                forStr = overrides[i].title + '<br>';
                forStr += sections[ overrides[i].course_section_id ].join(',');
            }
            if ( overrides[i].all_day && overrides[i].all_day_date!="" ){
              due = excelDate( overrides[i].due_at, 1 );
            } else{ 
              due = excelDate( overrides[i].due_at );
            }
            
            from = excelDate( overrides[i].unlock_at );
            til = excelDate( overrides[i].lock_at );
            newTable += getOverrideStr( due, forStr, from, til );
            
        }
        newTable +='</tbody></table>';

      $('#override').html( newTable );

  }
 
  function excelDate(timestamp, allDate=0) {
    var d;
    const monthNames = ["January", "February", "March", "April", "May", "June",
         "July", "August", "September", "October", "November", "December" ];

    try {
      if (!timestamp) {
        return '-';
      }
      timestamp = timestamp.replace('Z', '.000Z');
      var dt = new Date(timestamp);
      if (typeof dt !== 'object') {
        return '';
      }
      if (allDate){
        d =  pad(dt.getDate())  + ' ' + monthNames[dt.getMonth()];
      } else {
        d =  pad(dt.getDate())  + ' ' + monthNames[dt.getMonth()] + ' at ' +  pad(dt.getHours()) + ':' + pad(dt.getMinutes());
      }
      
    } catch (e) {
      errorHandler(e);
    }
    return d;
    function pad(n) {
      return n < 10 ? '0' + n : n;
    }
  }

  function overrideNames(index, e) {
    var override = overrides[index];
    overrides.splice(index, 1);
    var orderedIds = override.student_ids.sort(function(a, b) {
      return userData[a].sortable_name < userData[b].sortable_name ? -1 : 1;
    });
    var names = orderedIds.map(function(e, i) {
      return userData[e].name;
    });
    e.innerHTML = names.join(', ');
  }
  function errorHandler(e) {
    $('#override').html( '' );
    console.log(e.name + ': ' + e.message);
  }
})();
