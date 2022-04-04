// ==UserScript==
// @name        Canvas assignment score,comment import script
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description Canvas assignment bulk upload script
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/assignment-comment-import.user.js
// @include     https://*/courses/*/assignments/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.1.0/papaparse.min.js
// @version     0.1
// @grant       none
// ==/UserScript==
(function() {
  'use strict';
  // Change studentRegex for international support

  var studentRegex = new RegExp('^([0-9]+) student');
  var pending = -1;
  var fetched = 0;
  var needsFetched = 0;
  var ajaxPool;
  var userData = {};
  var userDataUserId = {};
  var upiDataUserId = {};
  var studentIdArray = [];
  var userIdArray = [];
  var upiArray = [];
  var fileEntries = [];
  var fileNameArray=[];
  var courseId;
  var assignmentId;
  var sections = {};
  var debug = 1;
  var debugCheckStudents = 1;
  var submissionAr = [];
  var aborted = false;
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();
  var uploadType = -1;
  var targetI = 1;
  var doing = 0;
  var useUserId = 0;
  var tmpToAdd = 0;
  var doneChecking = 0;
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (mm < 10) {
    mm = '0' + mm;
  }
  var excelExist = 0;
  var zipExist = 0;
  var studentsFromExcel;
  courseId = getCourseId();
  // build requests
  var requests = [];
  
  today = (yyyy-2000 ) + '-' + mm  + '-' + dd + '-' + Math.floor(Date.now() /1000) ;
  addSubmissionUploadButton();
  getUserSubmissionInfo( courseId );

 var saveText = (function () {
        var a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";
        return function (textArray, fileName) {
            var blob = new Blob(textArray, {type: "text"}),
                url = window.URL.createObjectURL(blob);
            a.href = url;
            a.download = fileName;
            a.click();
            window.URL.revokeObjectURL(url);
        };
    }());

  function addSubmissionUploadButton() {

    

    if ($('#assignment-commentImport').length === 0) {
        
        $('#sidebar_content').append(
            `<span><a href="javascript:void(0)" id="assignment-commentImport" class="ui-corner-all" role="menuitem">
                <i class="icon-analytics"></i> Bulk upload score and comment</a>
            </span>
            <form id="custom_upload_submissions_form" style="margin-top: 10px; display: none;" enctype="multipart/form-data" onsubmit="return false">
                <div style="padding-top:10px">
                    <label for="comments_file">Import comments file: <a href="https://flexiblelearning.auckland.ac.nz/temp/gradecommentsample.csv" download title="with at least 3 columns 'Score', 'Comment' and an identifier column of either ID/UPI/SIS USER ID">sample csv file</a>
                    
                    </label>
                    <input class="btn" type="file" id="comments_file"/>
                </div>
                <!--div>
                    <button id="step4Submit" type="submit" class="btn">Proceed to import</button> <br><br>
                </div-->
            </form>
            <div id="comments_modal" title="Import Comments"></div>
            <div id="comments_dialog" title="Import Comments"></div>
            <div id="comments_progress" title="Import Comments" style="display:none;"><p>Importing scores and comments. Do not navigate from this page.</p><div id="comments_bar"></div></div>
            `
            );

        
                
        $('#assignment-commentImport').one('click', {
        type: 2
        }, showCommentImportForm );
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
      throw new Error('Error configuring AJAX pool');
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

  async function showCommentImportForm(){
    pending = 0;
    fetched = 0;
    aborted = false;
    setupPool();
    
    //progressbar();
    pending = 0;
    //courseId = getCourseId();
    assignmentId = getAssignmentId();
    $("#comments_dialog").dialog({ autoOpen: false });
    $("#comments_progress").dialog({ buttons: {}, autoOpen: false });
    if ( debug ) console.log( { courseId, assignmentId } );
    if ( !courseId || !assignmentId ){
        return;
    }
    await showUploadCommentForm( );
    
   
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

  function getUserSubmissionInfo(courseId) {
    
    if ( debug ) console.log('in getUsers');
    var chunkSize = 100;
    var chunk;
    var url;
    var i = 0;
    //var n = userList.length;
    pending = 0;
    url = '/api/v1/courses/' + courseId + '/sections?include[]=students&include[]=email&per_page=100';
    
    getStudents( url, courseId );
    
  }

    
    function popUp(text) {
        $("#comments_dialog").html(`<p>${text}</p>`);
        $("#comments_dialog").dialog('open');
    }

  function getStudents( url, courseId ) { //cycles through the student list
    try {
      pending++;
      $.getJSON(url, function (udata, status, jqXHR) {
        url = nextURL(jqXHR.getResponseHeader('Link'));
        for (var i = 0; i < udata.length; i++) {
          var section = udata[i];
          if (debug){ console.log({section})}
            try {
                if (section.students.length > 0) {
                    for (var j = 0; j < section.students.length; j++) {
                        // login_id === upi
                        var user = section.students[j];
                        var splitname = user.sortable_name.split(',');
                        user.firstname = splitname[1].trim();
                        user.surname = splitname[0].trim();
                        //userData[user.id] = user;
                        userData[''+user.sis_user_id] = user;
                        userDataUserId[''+user.id] = user;
                        upiDataUserId[''+user.login_id] = user;
                        //sis_user_id ==> auid
                        studentIdArray.push( ''+user.sis_user_id );
                        userIdArray.push( ''+user.id );
                        upiArray.push(''+user.login_id);
                    } // end for
                } // end if length>0
                
            } catch(e){ continue; }
          
        }
        if (debug) console.log( {userData},{userDataUserId},{upiDataUserId} );
        if (debug) console.log( {studentIdArray},{userIdArray},{upiArray} );
        if (debug) console.log( "next url ?", url );
        //if (debug) console.log( "number ss:", studentIdAr.length );
        if (url) {
          getStudents( url, courseId );
        }
        pending--;
        if (debug) console.log( "pending:", pending );

        if (pending <= 0) {

            //showUploadCommentForm( );

        } else{}
      }).fail(function () {
        pending--;
        $('#jj_progress_dialog').dialog('close');
        throw new Error('Failed to load list of students');
      });
    } catch (e) {
      pending--;
      $('#jj_progress_dialog').dialog('close');
      throw new Error('Failed to load list of students');
      
    }
  }
  function confirm(text, callback) {
        $("#comments_modal").html(`<p>${text}</p>`);
        $("#comments_modal").dialog({
            buttons: {
                "Confirm": function() {
                    $(this).dialog("close");
                    callback(true);
                },
                "Cancel": function() {
                    $(this).dialog("close");
                    callback(false);
                }
            }
        });
        $("#comments_modal").dialog('open');
    }
  async function compareSubmission( tmpUrl, score, comment, student, subUrl ){
    if (debug) console.log( "compareSubmission:", tmpUrl, score, comment );
    let tmpToAdd = 0;
    score = parseInt(score);
    $.getJSON(tmpUrl, function (udata, status, jqXHR) {
      
        let tmpSubmission = udata;
        if (debug) console.log( {student}, "graded at:", udata.graded_at );
        if (debug) console.log( "score:", udata.score, {score} );

        if ( udata.graded_at ) {
          let tmpScore = udata.score;
          if ( tmpScore!= parseInt( score ) ){
            tmpToAdd = 1;
            
          } else {
            let submissionComments = udata.submission_comments;
            if (debug) console.log("submission comment length:", submissionComments.length);
            if ( submissionComments.length >0 ){
              for ( let i=0; i<submissionComments.length; i++){
                if ( submissionComments[i].comment==comment ){
                  tmpToAdd = 0;
                  break;
                }
              }
            } else {
              //if no previous comment, but with comment to input
              if ( comment !="" ){
                tmpToAdd = 1;
              }
            }
          }
          
        } else {
          tmpToAdd = 1;
          if (debug) console.log( "graded at: empty"  );
        }
        
        pending--;
        
        if (debug) console.log( {tmpToAdd} );
        if ( tmpToAdd ){
            requests.push({
                request: {
                    url: subUrl,
                    type: "PUT",
                    //data: formData,
                    //contentType: false,
                    //processData: false,
                    data: {
                      "comment[text_comment]": comment
                      ,"submission[posted_grade]":score
                    }, 
                    // to include submission[posted_grade]: score, for the import
                    dataType: "json" 
                    //dataType: "text" 
                    },
                error: `Failed to post comment for student ${student} and assignment ${assignmentId} using endpoint ${subUrl}. Response: `
            });
            if (debug) console.log(requests);
          }
        if ( pending <=0 ){
          if (debug) console.log("do update");
          doUpdate();
        }
        //return tmpToAdd;
    } ).fail(function () {
        tmpToAdd = 1;
        pending--;
        if ( pending <=0 ){
          if (debug) console.log("do update");
          $("#comments_dialog").dialog('open');
          doUpdate();
        }
        //return 1;
      } )
    
    
  }
 
  async function showUploadCommentForm(){
    //studentInfo to record student name/Auid/fileName
    var studentInfo;
    if (debug) console.log( 'in showUploadCommentForm' );
    jQuery('#custom_upload_submissions_form').show();
    //read student file name information from the excel file 
    $('#comments_file').change(async function(evt) {
        $("#comments_file").hide();
        // parse CSV
        Papa.parse(evt.target.files[0], {
            header: true,
            dynamicTyping: false,
            transformHeader:function(h) {
              return h.toLowerCase();
            },
            complete: async function(results) {
                $("#comments_file").val('');
                var data = results.data;
                if ( debug ) console.log({data});
                var referral = ' Visit <a href="https://oit.colorado.edu/services/teaching-learning-applications/canvas/enhancements-integrations/enhancements#oit" target="_blank">Canvas - Enhancements</a> for formatting guidelines.';
                if (data.length < 1) { 
                    popUp("ERROR: File should contain a header row and at least one data row." + referral);
                    $("#comments_file").show();
                    return;
                }
                let tmpKeys = Object.keys( data[0] );
                //tmpKeys = tmpKeys.map(element => {
                //  return element.toLowerCase();
               // });
                if (debug) console.log({tmpKeys});
                //if ( !Object.keys(data[0]).includes("ID") || !Object.keys(data[0]).includes("SIS User ID")|| !Object.keys(data[0]).includes("UPI") ) {
                if ( !( tmpKeys.includes("id") || tmpKeys.includes("sis user id")|| tmpKeys.includes("upi") ) ) {

                    popUp("ERROR: No 'SIS User ID' or 'ID' or 'UPI' column found." + referral);
                    $("#comments_file").show();
                    return;
                }
                if ( !tmpKeys.includes("score") ) {
                    popUp("ERROR: No 'score' column found." + referral);
                    $("#comments_file").show();
                    return;
                }
                if ( !tmpKeys.includes("comment") ) {
                    popUp("ERROR: No 'comment' column found." + referral);
                    $("#comments_file").show();
                    return;
                }
                
                if (Object.keys(data[0]).length < 3) {
                    popUp("ERROR: Header row should have 3 columns( 1: 'ID' or 'SIS User ID' or 'UPI' column, 2:'Score', 3: 'comment'  )" + referral);
                    $("#comments_file").show();
                    return;
                }

                
                let dataLength = data.length;
                
                pending = 0;
                popUp("<img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/> Determing what records need to be updated ..." );
                for (const row of data) {
                    // to get student id, as teacher could use 'upi' or 'sis user id' as first field
                    
                    if (debug) console.log( {dataLength} );
                    
                    let student = '';
                    let tmpUpi = '';
                    let tmpSISid = '';
                    let comment = '';
                    let score = 0;
                    if ( tmpKeys.includes('id') && userIdArray.includes( ''+row["id"] )) {
                       student = ''+ row["id"];
                    } else if ( tmpKeys.includes('upi') && upiArray.includes( ''+ row["upi"] ) ) {
                       tmpUpi = ''+ row["upi"];
                       
                    } else if ( tmpKeys[0].includes('sis user id') &&  studentIdArray.includes( ''+row["sis user id"] ) ) {
                       tmpSISid = ''+ row["sis user id"];
                       
                    }  else if ( tmpKeys.includes('sis login id') && upiArray.includes( ''+ row["sis login id"] ) ) {
                       tmpUpi = ''+ row["sis login id"];
                       
                    }
                    comment  = row['comment'];
                    score = row['score'];
                    if ( ( score=="" || score==0 ) && comment=="" ){
                      continue;
                    }
                    if ( debug ) console.log(student, score, comment);
                    if (student=="") {
                      continue;
                    }
                    //to check if record is the same, then no action required
                    let checkSubmissionUrl = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${student}?include[]=submission_comments`;
                    let subUrl = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${student}`;
                    
                    pending +=1;
                    await compareSubmission( checkSubmissionUrl, score, comment, student, subUrl);
                    
                    
                    
                    
                    
                } // end for

            }// end papa parse
            
            
        });
    }); // end comment_file change
  }
  function doUpdate(){
    // confirm before proceeding
    if (debug) console.log( 'now doing update score call' );
    if ( requests.length >0 ){
      confirm(
        `You are about to post ${requests.length} new score and comments.  Are you sure you wish to proceed?`,
        function(confirmed) {
            if (confirmed) {
                if (debug) console.log("confirmed");
                // send requests in chunks of 3 every second to avoid rate-limiting
                var errors = [];
                var completed = 0;
                var chunkSize = 10;
                function sendChunk(i) {
                    for (const request of requests.slice(i, i+chunkSize)) {
                        $.ajax(request.request).fail(function(jqXHR, textStatus, errorThrown) {
                            errors.push(`${request.error}${jqXHR.status} - ${errorThrown}\n`);
                        }).always(requestSent);
                    }
                    showProgress(i * 100 / requests.length);
                    if (i + chunkSize < requests.length) {
                        setTimeout(sendChunk, 1000, i + chunkSize);
                    }
                }

                // when each request finishes...
                function requestSent() {
                    completed++;
                    if (completed >= requests.length) {
                        // all finished
                        showProgress(100);
                        $("#comments_file").show();
                        if (errors.length > 0) {
                            popUp(`Import complete. WARNING: ${errors.length} comments failed to import. See errors.txt for details.`);
                            saveText(errors, "errors.txt");
                        } else {
                            popUp("All comments imported successfully!");
                        }
                    }
                    resetData();
                }
                // actually starts the recursion
                sendChunk(0);
            } else {
                // confirmation was dismissed
                $("#comments_file").show();
                resetData();
            }
        });
    } else {
      alert( 'All old record. Nothing to do!' );
    }
  } // end doUpdate

  function showProgress(amount) {
        if (amount === 100) {
            $("#comments_progress").dialog("close");
        } else {
            $("#comments_bar").progressbar({ value: amount });
            $("#comments_progress").dialog("open");
        }
    }
  
  

 
  
  

  
 
  

  

  

  function displayStudentProgressList(){
    let tmpId;
    let tmpName;
    let progressHtml;
    let numbStudents = studentsFromExcel.length-1;
    jQuery('#myProgress').append( `<h3 id="progressStatus" class="Button Button--warning">Please don't close this tab until the upload process finished  <img src="https://flexiblelearning.auckland.ac.nz/images/spinner.gif"/></h3>` );
    jQuery('#myProgress').append(`<br><label for='uploadProgress'><b>Progress:</b> &nbsp;</label>
    <progress id='uploadProgress' max="${numbStudents}" value="1"></progress>
    <span id="numFinished" style=""></span> / ${numbStudents} <br>
    `);
    for ( let i=1; i<studentsFromExcel.length; i++ ) {
        //if ( useUserId ){
            //use canvas user_id
            tmpId = 'progress' +i ;
            tmpName = studentsFromExcel[i][0];
            progressHtml = `<span class="progressStudent" id="container${tmpId}">
            <label for="${tmpId}">${tmpName}: &nbsp;&nbsp;</label>
            <progress id="${tmpId}" max="100" value="0"> </progress></span><br>`;
            jQuery('#myProgress').append( progressHtml );

        //}
    }
  }

  

  

  function resetData(){
    userData = {};
    userDataUserId = {};
    upiDataUserId = {};
    studentIdArray = [];
    userIdArray = [];
    upiArray = [];
    pending = - 1;
    fetched = 0;
    needsFetched = 0;
  
  }

  
  function errorHandler(e) {
    $('#override').html( '' );
    console.log(e.name + ': ' + e.message);
  }
  
  function confirmExit() {
        return "Upload process still going. Are you sure you want to exit?";
  }
})();
