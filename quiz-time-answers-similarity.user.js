// ==UserScript==
// @name        Canvas quiz answer/event timing/similarity information download
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description For Canvas users, this tool generates a spreadsheet file download of the all quiz answers, and time events of each choice/input, for similarity checking and remark purposes;
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/quiz-time-answers-similarity.user.js
// @include     https://*/courses/*/quizzes/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/xlsx.full.min.js
// @version     0.2
// @grant       none
// ==/UserScript==

// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement

(function () {
  'use strict';
  var userData = {
  };
  var questionAr = {};
  // questionsArray to store questions
  //var questionsArray = [];
  // answersArray to store answers of each questions
  //var answersArray = [];

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
  //var zip = new JSZip();
  var debug = 0;
  var debugEvent =0 ;
  var debugEventError = 1;
  var files = {};
  var answerOptions={};

  var resultUrlArray = [];
  var CRLF = ' \r\n';
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
  addQuizSimilarityButton();
  var ansId = 0;

  function addQuizSimilarityButton() {

        if ($('#quiz-events-similarity').length === 0) {
          $('.page-action-list').append('<li><a href="javascript:void(0)" id="quiz-events-similarity" class="ui-corner-all" role="menuitem"><i class="icon-analytics"></i> Quiz Answers Events/Similarity Download</a></li>');
          $('#quiz-events-similarity').one('click', {
            type: 2
          }, quizEventAnswersSimilarityReport);
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

  function quizEventAnswersSimilarityReport(e) { //gets the student list
    pending = 0;
    fetched = 0;
    reporttype = e.data.type;
    aborted = false;
    setupPool();
    courseId = getCourseId();
    quizId = getQuizId();
    if (debug) console.log( courseId, quizId );
    var url = '/api/v1/courses/' + courseId + '/sections?include[]=students&include[]=email&per_page=50';
    //https://auckland.test.instructure.com:443/api/v1/courses/41929/quizzes/37835/submissions?include[]=submission
    progressbar();
    pending = 0;
    jQuery.when(
      getFiles(courseId)
    ).done(  function(){
        getStudents( url, courseId, quizId );
      }
    )

  }
  //sample quiz events url
  //https://canvas.auckland.ac.nz/api/v1/courses/45668/quizzes/41366/questions?quiz_submission_attempt=1&quiz_submission_id=2653652&quiz_submission_id=2653652&quiz_submission_attempt=1&page=1
   //https://canvas.auckland.ac.nz/api/v1/courses/45668/quizzes/41366/submissions/2653652/events?attempt=1&per_page=50&page=1
   //
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

  function getFiles( courseId ){
    var fileUrl = '/api/v1/courses/'+ courseId + '/files?sort=created_at&order=desc&per_page=100';
    $.getJSON(fileUrl, function (adata, status, jqXHR) {
      // adata is an array of file objects
      if ( adata.length>0 ) {
        for ( let i=0; i< adata.length;i++ ){
          let fileId = adata[i].id;
          files[fileId] = adata[i];
        }
      }

    }
    ).done(function(){

    }).fail(function () {

    } );
    //get folder, find
  }
  function getStudents( url, courseId, quizId ) { //cycles through the student list
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
          //return if no students
          if ( i==0 && section.students===null ){

              pending--;
              alert( "No student found" );
              $('#jj_progress_dialog').dialog('close');
              $('#quiz-events-similarity').one('click', {
                type: 2
              }, quizEventAnswersSimilarityReport);
              resetData();
              throw new Error('Failed to load list of students');

          }
          try {
              if (section.students.length > 0) {
                  for (var j = 0; j < section.students.length; j++) {
                      // login_id === upi
                      var user = section.students[j];
                      var splitname = user.sortable_name.split(',');
                      user.firstname = splitname[1].trim();
                      user.surname = splitname[0].trim();
                      user.questionAr = {};
                      user.eventsAr = {};
                      user.totalScore = '';
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
            let urlAns = '/api/v1/courses/' + courseId + '/quizzes/'+ quizId + '/submissions?include[]=submission&per_page=50';

            getAnswers( urlAns, courseId, quizId );

        }
      }).fail(function () {
        pending--;
        $('#jj_progress_dialog').dialog('close');
        throw new Error('Failed to load list of students');

      });
    } catch (e) {
      errorHandler(e);
      $('#jj_progress_dialog').dialog('close');
    }
  }
  function getAnswers( url, courseId, quizId ) { //cycles through the student list
    let quiz_submissions = [];
    let tmpName = "";
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      if (debug) console.log( "student Data:", userData );
      if (debug) console.log( "getting answers:", url );
      jQuery("#doing").html( "Fetching question answers <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
      pending++;
      $.getJSON(url, function (udata, status, jqXHR) {
        url = nextURL(jqXHR.getResponseHeader('Link'));
        quiz_submissions = udata.quiz_submissions;
        if (debug) console.log( "quiz_submissions:", quiz_submissions );

		    if ( quiz_submissions.length==0 || quiz_submissions===null ){

              pending--;
              alert( "No submission found" );
              $('#jj_progress_dialog').dialog('close');
              $('#quiz-events-similarity').one('click', {
                type: 2
              }, quizEventAnswersSimilarityReport);
              resetData();
              throw new Error('Failed to load list of students');

        }
	    	needsFetched = Object.getOwnPropertyNames(userData).length;
        for (var i = 0; i < quiz_submissions.length; i++) {
          var submission = quiz_submissions[i];
          let studentid =  submission.user_id;
          let submission_id = submission.id;
		      progressbar(i, quiz_submissions.length);
          if (debug) console.log( submission, studentid );
          try {
            tmpName = userData[ studentid ].short_name.replace(/ /g, "");
          } catch(e){
            tmpName = "";
            continue;
          }
          if (debug) console.log( "submission:", submission );
          if (debug) console.log( "tmpName:", tmpName );

          try {
              if ( "result_url" in submission && submission.result_url!="" ) {
                resultUrlArray.push( [ submission.result_url, studentid, submission_id ] );
              } else if ( "html_url" in submission && submission.html_url!="" ) {
                resultUrlArray.push( [ submission.html_url, studentid, submission_id ] );
              }
          } catch(e){ continue; }
        } // end for quiz_submissions
        if (url) {
          getAnswers( url, courseId, quizId );
        }
        pending--;
        if (pending <= 0) {
            if (debug) console.log( "resultUrlArray", resultUrlArray );
            getQuizAnswerReport( courseId, quizId );

        }
      }).fail(function () {
        pending--;
        throw new Error('Failed to load student submissions');
      });
    } catch (e) {
      errorHandler(e);
    }
  }

  function getQuizAnswerReport( courseId, quizId ) { //cycles through student list
    pending = 0;
    fetched = 0;
    let url = "";
    let tmpName= '';
    getQuizAns();
  }

  function getQuizAns(){
    pending++;
    let url = resultUrlArray[ansId][0];
    let studentid = resultUrlArray[ansId][1];
    getQuizAnswers( url, courseId, quizId, studentid );
  }
////////////////////////////////////////////////////////////////////////////////////

  function getEvents(){
    //pending++;
    let submission_id = resultUrlArray[ansId][2];
    let studentid = resultUrlArray[ansId][1];
    let url =  `/api/v1/courses/${courseId}/quizzes/${quizId}/submissions/${submission_id}/events?attempt=1&per_page=50`;
    fetched+=1;
    progressbar(fetched, needsFetched);
    getSubmissionEvents( url, courseId, quizId, studentid, submission_id );
  }

  function getSubmissionEvents( url, courseId, quizId, studentid, submission_id ){

    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      jQuery("#doing").html( "Fetching events informaton <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
      pending++;
      $.getJSON(url, function (udata, status, jqXHR) {
        url = nextURL(jqXHR.getResponseHeader('Link'));
        let quizEvents = udata.quiz_submission_events;
        let prevViewTime = '';
        if ( quizEvents.length==0 ) {
          //no events, go to collect next events
          ansId +=1;
          if (ansId>=resultUrlArray.length && !aborted) {
            makeReport( courseId, quizId );
          } else{
            getEvents();
          }
          return;
        }
        //get event-type: submission_created , all answer text
        try {
          if ( quizEvents[0].event_type=="submission_created" ){
            let quizData = quizEvents[0].event_data.quiz_data;
            if (debugEvent) console.log( 'quizData:', quizData );
            prevViewTime = excelTime( quizEvents[0].created_at );
            for ( let m=0;m<quizData.length;m++){
              let tmpQuiz = quizData[m];
              // collect multiple choice options into answerOptions
              if ( "answers" in tmpQuiz ) {
                let tmpAnswers = tmpQuiz.answers;
                if (debugEvent) console.log( 'tmpAnswers:', tmpAnswers );

                //record all the answers text and id
                for ( let k=0; k<tmpAnswers.length;k++){
                  let tmpOption = tmpAnswers[k];
                  let tmpAnsId = tmpOption.id;
                  let tmpAns = stripHtml( tmpOption.text );
                  answerOptions[ tmpAnsId ] = tmpAns;
                  if (debugEvent) console.log( 'push answerOptions:', tmpAnsId, tmpAns );

                }
              }

            }//end first loop
          }

          if (debugEvent) console.log( 'answerOptions:', answerOptions );
          for (var i = 0; i < quizEvents.length; i++) {
            let tmpEvent = quizEvents[i];
            if ( tmpEvent.event_type=="question_answered" || tmpEvent.event_type=="question_viewed"){
              let event_data = tmpEvent.event_data;
              let event_time = excelTime( tmpEvent.created_at );
              let tmpAnsText='';
              
              //event_data.quiz_question_id: "924887",
              //"answer": "8495"
              for ( let j=0; j< event_data.length; j++ ){
                //store event when answer is not null
                if (debugEvent) console.log( 'event_data.answer', event_data[j].answer );
                if ( tmpEvent.event_type=="question_answered" ){
                  if ( event_data[j].answer && typeof(event_data[j].answer) != 'object' ){
                    let quizId = event_data[j].quiz_question_id;
                    //if ( event_data[j].answer in answerOptions ) {
                    //  tmpAnsText = answerOptions[ event_data[j].answer ];
                    //} else {
                     tmpAnsText = stripHtml( event_data[j].answer );
                    //}
                    
                    let tmpObj = {};
                    tmpObj.answer = tmpAnsText;
                    tmpObj.time = event_time;
                    if (!( quizId in userData[studentid].eventsAr ) ) {
                      userData[studentid].eventsAr[quizId] = [];
                    }
                    //PUSH Question view time
                    if ( prevViewTime !='' ){
                      let tmpObj1 = {};
                      tmpObj1.answer = 'view';
                      tmpObj1.time = prevViewTime;
                      userData[studentid].eventsAr[quizId].push( tmpObj1 );
                    }
                    //store the user quiz event
                    userData[studentid].eventsAr[quizId].push( tmpObj );
                  }  
                } else {
                  // event is page viewed
                  prevViewTime = event_time;
                  if (debug) console.log( "question_viewed time:", prevViewTime );
                }
                
              }

            }
            if (debugEvent) console.log( 'event:', tmpEvent );

          }
          if (debugEvent) console.log( studentid, ' event ar:', userData[studentid].eventsAr );
          if (url) {
            getSubmissionEvents( url, courseId, quizId, studentid, submission_id );
          } else {
            //get next submission events
            ansId +=1;
            if (ansId>=resultUrlArray.length && !aborted) {
              makeReport( courseId, quizId );
            } else{
              getEvents();
            }

          }
        } catch(e) {
          //get next submission events
          if (debugEventError) console.log( "quiz event error:", quizEvents[0] );
          ansId +=1;
          if (ansId>=resultUrlArray.length && !aborted) {
            makeReport( courseId, quizId );
          } else{
            getEvents();
          }

        }


      }).fail(function () {
        pending--;
        $('#jj_progress_dialog').dialog('close');
        throw new Error('Failed to load events');

      });
    } catch (e) {
      errorHandler(e);
      $('#jj_progress_dialog').dialog('close');
    }
  }
  ////////////////////////////////////////////////////////////////////////////////
  function getQuizAnswers( url, courseId, quizId, studentid ) { //get answer data
    var tmpQuizSubmissions;
    var tmpItem;
    var tmpUrl;
    var savename;
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      if (debug) console.log( url );
      jQuery("#doing").html( "Fetching question answers <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
      //pending++;
      progressbar(fetched, needsFetched);
      $.get(url, function (adata, status, jqXHR) {
        fetched +=1;
        let totalAns = "";
        let totalScore = jQuery(adata).find( "#after_fudge_points_total" ).text();
        if (debug) console.log( 'totalScore', totalScore );
        userData[studentid].totalScore = totalScore;
        if (debug) console.log( 'studentid, totalScore:', studentid, userData[studentid].totalScore );
        jQuery(adata).find('.question').each(
          function(){
            //find classes to see question type
            let questionType = '';
            let questionText = '';
            let answerText = '';
            let tmpScore = 0;
            let tmpQuizObj = {};


            let classes= jQuery(this).attr('class');
            if ( classes.indexOf('multiple_choice_question') >-1 ){
              questionType='mcq';
            } else if ( classes.indexOf('multiple_dropdowns_question') >-1 ) {
              questionType='select';
            } else if ( classes.indexOf('true_false_question') >-1 ) {
              questionType='true_false';
            } else if ( classes.indexOf('short_answer_question') >-1 ) {
              questionType='short_answer';
            } else if ( classes.indexOf('true_false_question') >-1 ) {
              questionType='true_false';
            } else if ( classes.indexOf('fill_in_multiple_blanks_question') >-1 ) {
              questionType='multiple_blanks';
            } else if ( classes.indexOf('multiple_answers_question') >-1 ) {
              questionType='checkbox';
            } else if ( classes.indexOf('matching_question') >-1 ) {
              questionType='matching';
            } else if ( classes.indexOf('numerical_question') >-1 ) {
              questionType='number';
            } else if ( classes.indexOf('essay_question') >-1 ) {
              questionType='essay';
            } else if ( classes.indexOf('file_upload_question') >-1 ) {
              questionType='file';
            }


            //get question id
            let tmpIdStr = jQuery(this).attr('id');
            let tmpQid = tmpIdStr.split( '_' )[1];
            //find question text
            questionText = jQuery( this ).find('.question_text').html();
            if (debug) console.log( "tmpQid:questionText", tmpQid, questionText );
            if (! (tmpQid in questionAr) ) {
              if (debug) console.log( "tmpQid:questionText", tmpQid, questionText );
              questionAr[tmpQid] = stripHtml( questionText );
            }

            // to replace image with file name
            //find score
            tmpScore = jQuery( this ).find('.question_input').val();
            //find student answer
            switch (questionType){
              case 'mcq':
                answerText += jQuery(this).find('.selected_answer').find('.answer_text').html();
                if ( debug ) console.log( "mcq answer:", answerText );
                break;
              case 'select':
                jQuery(this).find('.selected_answer' ).each(
                  function(){
                    answerText += jQuery( this ).find('.answer_text').html() + '|';
                  }
                );
                if ( debug ) console.log( "select:", answerText );

                break;
              case 'true_false':
                answerText += jQuery(this).find('.selected_answer').find('.answer_text').html();
                if ( debug ) console.log( "true_false:", answerText );

                break;
              case 'multiple_blanks':
                jQuery(this).find('.selected_answer').each(function(){
                  answerText += jQuery(this).find('.answer_text').html() + '|';
                });
                if ( debug ) console.log( "multiple_blanks:", answerText );

                break;
              case 'checkbox':
                jQuery(this).find('.selected_answer').each(function(){
                  answerText += jQuery(this).find('.answer_text').html() + '|';
                });
                if ( debug ) console.log( "checkbox:", answerText );

                break;
              case 'matching':
                jQuery(this).find('.question_input').each(function(){
                  answerText += jQuery(this).val() + '|';
                });
                if ( debug ) console.log( "matching:", answerText );

                break;
              case 'number':
                answerText += jQuery(this).find('.numerical_question_input').val();
                break;
              case 'essay':
                answerText += jQuery(this).find('.quiz_response_text').html();
                if ( debug ) console.log( "essay:", answerText );

                break;

              case 'file':
                answerText += jQuery(this).find('.selected_answer').find('.icon-download').text();
                if ( debug ) console.log( "file:", answerText );

                break;

              default:
                answerText = '';
            }
            //
            if ( debug ) console.log( url, classes, questionText, tmpScore, answerText );
            //push quiz record of the student
            tmpQuizObj.answerText = stripHtml( answerText );
            tmpQuizObj.score = tmpScore;
            userData[studentid].questionAr[ tmpQid ]= tmpQuizObj;
            //userData[studentid].totalScore = totalScore;

          }
        ); // end get each question
        // savename = tmpName + '-course-' + courseId + '.txt';
        // if (debug) console.log( "savename:", savename );
        // if (debug) console.log( "totalAns:", totalAns );
        // zip.file( savename, totalAns );
        pending--;
        if (debug) console.log( "get quizAnswers pending:", pending );
        ansId+=1;
        if (ansId>=resultUrlArray.length && !aborted) {
          //done collect quiz answers, now collect events
          ansId = 0; // start from start
          //progressbar();
          fetched =0;
          getEvents();
        }else{
          getQuizAns();
        }
      }).fail(function () {
        pending--;
        fetched+=50;
        progressbar(fetched, needsFetched);
        ansId+=1;
        if (!aborted) {
          console.log('Some report data failed to load');
        }
      }); // end get url
    } catch (e) {
      errorHandler(e);
    } // end try


  } // end getQuizAnswers
  function stripHtml(targetHtml){
    let tmpDiv = jQuery('<div/>').append(targetHtml);
    tmpDiv.find('img').each(function(){
      let src = jQuery(this).attr('src');
      let tmpName = src.split().pop();
      jQuery(this).replaceWith(`(img${tmpName})`);
      if (debug) console.log( tmpName );
    });
    targetHtml = tmpDiv.text();
    if (debug) console.log( 'targetHtml replaced' );
    return targetHtml.replace(/(<([^>]+)>)/gi, "").replace(/\[.*\]/gi, "").replace(/(\r\n|\n|\r)/gm,"").trim();
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
    var courseTitle="";
    var tmpArr = [];
    try {
        courseTitle=document.title.split( ":" ).slice(-1)[0].replace(/[^\w]/g, "");
        quizTitle=document.title.split( ":" )[0].replace(/[^\w]/g, "");
    } catch(e){}


    //try {
      if (aborted) {
        console.log('Process aborted');
        aborted = false;
        return;
      }
      progressbar();
      createQuizReport(courseTitle, quizTitle);

      // csv = createQuizReportCSV();

      // if (csv) {
      //   var blob = new Blob([csv], {
      //     'type': 'text/csv;charset=utf-8'
      //   });

      //   var savename = 'course-' + courseId + '-quizReport-' + quizTitle + '-' + today + '.csv';
      //   saveAs(blob, savename);
      // }
      // zip.generateAsync({type:"blob"})
      //.then(function(content) {
      // Force down of the Zip file
      //  saveAs(content, courseTitle+"-"+ quizTitle+ "-" + today + ".zip");
     // } );

        $('#quiz-events-similarity').one('click', {
            type: 2
        }, quizEventAnswersSimilarityReport);
        resetData();


    //} catch (e) {
    //  errorHandler(e);
    //}
  }

  function createQuizReport( courseTitle, quizTitle ) {
    if (debug) {
      console.log( 'questionAr' );
      console.log(questionAr);
    }

    var fields = [
      'id',
      'sis_user_id',
      'login_id',
      'name',
      'email',
      'total'
    ];

    for ( const qid in questionAr ){
      fields.push( qid );
      fields.push( qid + '-score' );
    }
    //titleAr to store title for access code

    var titleAr = [
        'Canvas_User_ID',
        'AUID',
        'Username',
        'Display_Name',
        'Email'
    ];
    let k=0;
    for ( const qid in questionAr ) {
      k+=1;
      if ( questionAr[qid].length>40 ) {
        titleAr.push( `Q${k}:`+ questionAr[qid].substring(0,40) + '...' );
      } else {
        titleAr.push( `Q${k}:`+ questionAr[qid] );

      }
      //titleAr.push( `Q${k}: ${qid}`);
      titleAr.push( `Q${k} Score` );
    }
    var reportAr=[];
    var reportEventsAr=[];
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
    var tmpAssetId;
    var tmpObjLength;

    //loop through userData
    for (var id in userData) {
        //tmpUpi = userData[id].login_id;
        //tmpAr = [] ;
        if (debug) console.log( "userData loop id:", id );
        let tmpObj = {};
        tmpObj['id'] = userData[id].id;
        tmpObj['sis_user_id'] = userData[id].sis_user_id;
        tmpObj['login_id'] = userData[id].login_id;
        tmpObj['name'] = userData[id].name;
        tmpObj['email'] = userData[id].email;
        tmpObj['total'] = userData[id].totalScore;
        let k=0;
        let tmpStr = '';
        let tmpScore = '';
        let tmpTime = '';
        for ( const qid in questionAr ) {
          k+=1;
          if ( questionAr[qid].length>40 ) {
            tmpStr = `Q${k}:`+ questionAr[qid].substring(0,40) + '...' ;
          } else {
            tmpStr = `Q${k}:`+ questionAr[qid] ;
          }
          tmpScore = `Q${k} Score`;

          if ( qid in userData[id].questionAr ){
            tmpObj[tmpStr] = userData[id].questionAr[qid].answerText;
            tmpObj[tmpScore] = userData[id].questionAr[qid].score;
          } else{
            tmpObj[tmpStr] = '';
            tmpObj[tmpScore] = '';
          }

        }
        reportAr.push(tmpObj);
        let tmpEventObj = Object.assign({}, tmpObj);
        tmpEventObj[tmpStr]='';
        //delete tmpEventObj[tmpScore];

        //record events
        k =0;
        for ( const qid in questionAr ) {
          k+=1;
          if ( questionAr[qid].length>40 ) {
            tmpStr = `Q${k}:`+ questionAr[qid].substring(0,40) + '...' ;
          } else {
            tmpStr = `Q${k}:`+ questionAr[qid] ;
          }
          
          tmpEventObj[tmpStr]='';
          tmpTime =`Q${k} event time`;
          if ( userData[id].eventsAr[qid] && userData[id].eventsAr[qid].length>0 ){
            userData[id].eventsAr[qid].forEach(function(tmpEvent){
              let tmpTimeStr='';
              if ( tmpEvent.time ){
                tmpTimeStr = `(${tmpEvent.time})  `;
              }
              tmpEventObj[tmpStr] += CRLF + tmpTimeStr + tmpEvent.answer ;
              //tmpEventObj[tmpTime] += tmpEvent.time + CRLF;
            })
          }
        }
        reportEventsAr.push(tmpEventObj);

    }
    var wb = XLSX.utils.book_new();
    wb.Props = {
      Title: `${courseTitle}-${quizTitle} Quiz similarity report`,
      Subject:"Quiz submission similarity report",
      Author: "",
      CreatedDate: new Date()
    };
    let tmpWs = XLSX.utils.json_to_sheet( reportAr  );
    XLSX.utils.book_append_sheet( wb, tmpWs, 'summary' );
    let tmpEventsWs = XLSX.utils.json_to_sheet( reportEventsAr  );
    XLSX.utils.book_append_sheet( wb, tmpEventsWs, 'Events' );
    let wbout = XLSX.write(wb, {bookType:'xlsx',  type: 'binary'});
    let blob = new Blob([ s2ab(wbout) ], {
      'type': 'application/octet-stream'
    });

    let savename = "quizReport" + courseTitle +"-" + quizTitle + "-" + today  + '.xlsx';
    saveAs(blob, savename);

//     if (debug) console.log( "remoteIp reportAr:", reportAr );
//     var CRLF = '\r\n';


//     var t = titleAr.join(',').toLowerCase() + CRLF;//csv first line

// //if (debug) { console.log( reportAr); }
//       //for (var item in reportAr) {
//       for (var id in userData) {
//         user = userData[id];
//         userId = user.id;

//         item = reportAr[userId];
//        // if (debug) { console.log( userId, item ); }
//        if (debug) console.log( item );
//         for (var j = 0; j < fields.length; j++) {
//           tmpFieldName = fields[j];
//           value = item[ tmpFieldName ];
//           //if (1) { console.log( "fieldName",tmpFieldName, value ); }

//           if (value === null || typeof(value)=='undefined') {
//             value = '';
//           } else {

//             if (typeof value === 'string') {
//               var quote = false;
//               if (value.indexOf('"') > - 1) {
//                 value = value.replace(/"/g, '""');
//                 quote = true;
//               }
//               if (value.indexOf(',') > - 1) {
//                 quote = true;
//               }
//               if (quote) {
//                 value = '"' + value + '"';
//               }
//             }
//           }
//           if (j > 0) {
//             t += ',';
//           }
//           t += value;
//         }
//         t += CRLF;
//       }

    //return t;
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
                  $('#quiz-submissions-report').one('click', {
                    type: 2
                  }, quizEventAnswersSimilarityReport );
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
//convert the binary data into octet
function s2ab(s) {
  var buf = new ArrayBuffer(s.length); //convert s to arrayBuffer
  var view = new Uint8Array(buf);  //create uint8array as viewer
  for (var i=0; i<s.length; i++) {
    view[i] = s.charCodeAt(i) & 0xFF; //convert to octet
  }
  return buf;
}

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
function excelTime(timestamp) {
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
    d = pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
    //d = ""+ pad(dt.getFullYear()-2000) +  pad(1 + dt.getMonth()) +  pad(dt.getDate()) + ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
  } catch (e) {
    errorHandler(e);
  }
  return d;
  function pad(n) {
    return n < 10 ? '0' + n : n;
  }
}
  function resetData(){
    //questionsArray = [];
    // answersArray to store answers of each questions
    //answersArray = [];
    resultUrlArray = [];
    pending = - 1;
    fetched = 0;
    needsFetched = 0;
  }

  function errorHandler(e) {
    console.log(e.name + ': ' + e.message);
  }
}) ();

