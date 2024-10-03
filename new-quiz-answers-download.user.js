// ==UserScript==
// @name        Canvas new quizzes student answers download
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description Canvas new quizzes student answers downloa
// @match      https://auckland.quiz-lti-syd-prod.instructure.com/lti/launch
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/xlsx.full.min.js
// @resource     REMOTE_CSS https://du11hjcvx0uqb.cloudfront.net/dist/brandable_css/new_styles_normal_contrast/bundles/common-1682390572.css
// @version     0.3
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==
/* global $, jQuery,XLSX,saveAs */

// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement

(function () {
  'use strict';
  
  const myCss = GM_getResourceText("REMOTE_CSS");
  GM_addStyle(myCss);
  
  var courseReportIndex = -1;
  var users = [];
  var userNameList = {};
  var totalStudents = 0;
  var sessionFetched = 0;
  
  var tokenId = "";
  var launch_url = "";
  var assignmentId="";
  //global array to collect reports
  var reportsAr = {};
  var quizItems = {};
  var studentsAnswers = {};
  var choiceItems = {};
  var maxAttempt = 1;
  //store all attempt sessions and userId
  var sessionList = [];
   
  var pending = -1;
  var fetched = 0;
  var needsFetched = 0;
  var ajaxPool;
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();
  getToken();
  var pageId = 1;
  var debug = 0;
  var debugReport = 0;
  var titleAr = [];
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (mm < 10) {
    mm = '0' + mm;
  }

  var linkPattern = `https://auckland.quiz-lti-syd-prod.instructure.com/api/assignments/${assignmentId}/participants?page=${pageId}`;
 
  today = (yyyy-2000 ) + '-' + mm + '-' + dd + '-' + Math.floor(Date.now() /1000) ;
  var aborted = false;
  $( 'body' ).ready( function(){
        setTimeout(function () {  
            addDownloadReportButton();
        }, 5000 );
    }  );

  function addDownloadReportButton() {

        console.log( "in addDownloadReportButton", {tokenId} )
        if ( tokenId!=null ){
            if ($('#download-answers').length === 0) {
              if ($('.css-q235k2')){
                $('.css-q235k2').before('<div class="css-1qsek3h-view-tab""><div id="download-answers">Download answers</div></div>');
                $('#download-answers').one('click', {
                  type: 1
                }, allAnswers);
              } else {
                $('header').append('<div class="css-1qsek3h-view-tab""><div id="download-answers">Download answers</div></div>');
                $('#download-answers').one('click', {
                  type: 1
                }, allAnswers);
              }
                
            }
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
  

  function allAnswers(e) { //gets the student list

    fetched = 0;
    aborted = false;
    
     setupPool();

    progressbar();
    pending = 0;
    console.log( {linkPattern} );
    getStudents();
  

    //getBatch();

  }

  function getStudents(){
    let tmpUserId;
    console.log( {linkPattern}, {pageId} );
    $.ajaxSetup({
        headers: { 'Authorization': `Bearer ${tokenId}` }
        ,timeout: 15000
    });
    $.getJSON( linkPattern, function (udata, status, jqXHR) {
        totalStudents = jqXHR.getResponseHeader('Total');
        
        if (debug) console.log( {udata}, totalStudents );
        //push result to reportAr
        for ( let i=0; i<udata.length;i++){
            //userid
            tmpUserId = udata[i].user_id;
            userNameList[ tmpUserId ] = udata[i].user.full_name;
            users.push( udata[i] );
        }
        if ( 50*pageId  < totalStudents ){
            pageId +=1;
            linkPattern = `https://auckland.quiz-lti-syd-prod.instructure.com/api/assignments/${assignmentId}/participants?page=${pageId}`;
            getStudents();
        } else {
            //to get each quiz sessions
            //https://auckland.quiz-lti-syd-prod.instructure.com/api/quiz_sessions/${quiz_api_quiz_session_id}
            //"participant_sessions": quiz_api_quiz_session_id

            console.log( users ); 
           
            getAllSessions();
        }
      }).fail(function () {
        
        throw new Error('Failed to load students');
      });
    
  }
  function getAllSessions(){
    let user, userId;
    for ( let i=0;i<users.length;i++ ){
      user = users[i];
      //console.log( {user} );
      userId = user.user_id;
      if ( "participant_sessions" in user ){
        for ( let j=0; j< user["participant_sessions"].length; j++ ){
          if ( user[ "participant_sessions" ][j].submitted_at ){
            sessionList.push( [userId, user[ "participant_sessions" ][j].quiz_api_quiz_session_id ] );
          }
        }
      }
    }
    console.log( "getAllSessions", { sessionList } );
    needsFetched = sessionList.length;
    sessionFetched = -1;
    getQuizAnswers();
  }

  async function getQuizAnswers(){
    if (aborted) {
        console.log('Process aborted');
        aborted = false;
        return;
    }
    progressbar(sessionFetched, needsFetched);
    //get the user
    sessionFetched +=1;
    
    if ( sessionFetched > (sessionList.length-1) ){
      //generate result
      if (debug) console.log( "done all get attempts", {studentsAnswers} );
      generateReports();
      return;
    }
    let currentSession = sessionList[ sessionFetched ];
    let userId = currentSession[0];
    let tmpQuizSessionId = currentSession[1];
    
    if (debug) console.log( "getQuizAnswers:", {userId}, {tmpQuizSessionId} );
    
    await doStep1( userId, tmpQuizSessionId );    
    
  }
  async function doStep1( userId, tmpQuizSessionId ){
    let tmpUrl = `https://auckland.quiz-lti-syd-prod.instructure.com/api/quiz_sessions/${tmpQuizSessionId}`;
    let attemptId;
    $.ajaxSetup({
        headers: { 'Authorization': `Bearer ${tokenId}` }
        ,timeout: 15000
    });
    $.getJSON( tmpUrl, async function(udata, status, jqXHR) {
      let resultToken = udata.token;
      if ( "attempt_history" in udata ){
        for ( let i=0; i< udata["attempt_history"].length;i++){
          if ( udata["attempt_history"][i].authoritative ){
            //get attemptId;
            attemptId = udata["attempt_history"][i].id;
            if (debug) console.log( "in step1:", {tmpQuizSessionId}, {attemptId} );
            await doStep2( userId, tmpQuizSessionId, attemptId, resultToken );
          } // end if
        } // end for
      } // end attempt_history
      
    }).fail(function () {          
      getQuizAnswers();
      throw new Error('Failed to load students');
    });
  } // end doStep1

  async function doStep2( userId, quizSessionId, attemptId, resultToken){
    //https://auckland.quiz-lti-syd-prod.instructure.com/api/participant_sessions/465795/grade
    let tmpUrl = `https://auckland.quiz-lti-syd-prod.instructure.com/api/participant_sessions/${attemptId}/grade`;
    $.ajaxSetup({
        headers: { 'Authorization': `Bearer ${tokenId}` }
        ,timeout: 15000
    });
    $.getJSON( tmpUrl, async function (udata, status, jqXHR) {
      let resultToken = udata.token;
      await doStep3( userId, quizSessionId, attemptId, resultToken );
    }).fail(function () {     
      getQuizAnswers();     
      throw new Error('Failed to doStep2:', attemptId, resultToken);
    });

  } // end doStep2

  async function doStep3( userId, quizSessionId, attemptId, resultToken){
    let resultId;
    if (debug) console.log( "in step3:", quizSessionId, attemptId, resultToken );
    //to get "authoritative_result" id
    //https://auckland.quiz-lti-syd-prod.instructure.com/api/participant_sessions/465795/grade
    let tmpUrl = `https://auckland.quiz-api-syd-prod.instructure.com/api/quiz_sessions/${quizSessionId}?anonymous_grading=false`;
    $.ajaxSetup({
        headers: { 'Authorization': `${resultToken}`, "Authtype":"Signature", "Accept":"application/json" }
        ,timeout: 15000
    });
    $.getJSON( tmpUrl, async function(udata, status, jqXHR) {
      if ( "authoritative_result" in udata ) {
        resultId = udata["authoritative_result"].id;
        if (debug) console.log( "step3:", {resultId} );
        await doStep4( userId, quizSessionId, attemptId, resultToken, resultId );
      }
    }).fail(function () {   
      getQuizAnswers();       
      throw new Error('Failed to doStep3:', attemptId, resultToken);
    });

  } // end doStep3

 async function doStep4( userId, quizSessionId, attemptId, resultToken, resultId ){
    
    let quizId, quizBody, quizItem, choices;

    if (debug) console.log( "in step4:", quizSessionId, attemptId, resultToken );
    //to get "authoritative_result" id
    let tmpUrl = `https://auckland.quiz-api-syd-prod.instructure.com/api/quiz_sessions/${quizSessionId}/session_items?`;
    //let tmpUrl = `https://auckland.quiz-api-syd-prod.instructure.com/api/quiz_sessions/${quizSessionId}?anonymous_grading=false`;
    $.ajaxSetup({
        headers: { 'Authorization': `${resultToken}`, "Authtype":"Signature", "Accept":"application/json" }
        ,timeout: 15000
    });
    $.getJSON( tmpUrl, async function(udata, status, jqXHR) {
      //read quiz items 
      for ( let i=0; i<udata.length;i++ ){
        quizItem = udata[i];
        quizId = quizItem["item"].id;
        
        //quizBody = quizItem["item"].item_body;
        quizBody = quizItem["item"].title;
        //try{
          if ( "choices" in quizItem["item"].interaction_data){
             
            choices = quizItem["item"].interaction_data.choices;
            if (debug) console.log( "step4 options:",{ choices } );
            for ( let m=0;m<choices.length; m++ ){
              choiceItems[ choices[m].id ] = choices[m].item_body;
            }          
          }
        //} catch(e){}
        
        if (debug) console.log( {quizId}, {quizBody} );
        if ( ! (quizId in quizItems) ){
          quizItems[quizId] = quizBody;
        }
      }

      await doStep5(userId, quizSessionId, attemptId, resultToken, resultId );
    }).fail(function () {       
      getQuizAnswers();   
      throw new Error('Failed to doStep5:', attemptId, resultToken);
    });

  } // end doStep4

 async function doStep5( userId, quizSessionId, attemptId, resultToken, resultId ){
  //step 5 collect user answers
    let ansObj = {};
    let attempt;
    let itemId, ssAnswer, tmpObj,quizText, score;
    if (debug) console.log( "in step5:", quizSessionId, attemptId, resultToken );
    //to get "authoritative_result" id
    let tmpUrl = `https://auckland.quiz-api-syd-prod.instructure.com/api/quiz_sessions/${quizSessionId}/results/${resultId}/session_item_results?`;
    //let tmpUrl = `https://auckland.quiz-api-syd-prod.instructure.com/api/quiz_sessions/${quizSessionId}?anonymous_grading=false`;
    $.ajaxSetup({
        headers: { 'Authorization': `${resultToken}`, "Authtype":"Signature", "Accept":"application/json" }
        ,timeout: 15000
    });
    $.getJSON( tmpUrl, async function(udata, status, jqXHR) {
      if (debug) console.log( "Step5:",{udata} );
      for ( let i=0; i< udata.length; i++ ){
        attempt = udata[i];
        itemId = attempt.item_id;
        score = attempt.score?attempt.score:"";
        try{

        
          if (attempt.scored_data.value.user_response){
            ssAnswer = attempt.scored_data.value.user_response;
          } else {
            if (typeof attempt.scored_data.value === "string"){
              //text answer
              ssAnswer = attempt.scored_data.value;
            }else if (typeof attempt.scored_data.value === "object"){
              tmpObj = attempt.scored_data.value;
              if (debug) console.log( "step5:", {tmpObj} );
              ssAnswer = '';
              let tmpKeys = Object.keys(tmpObj);
              let tmpKey;
              if (debug) console.log( "step5:", {tmpKeys} );
              for ( let j =0; j<tmpKeys.length;j++ ) {
                tmpKey = tmpKeys[j];
                if (debug) console.log( "step5:", {tmpKey} );
                try{
                  if (tmpObj[tmpKey].user_responded) {
                    ssAnswer += choiceItems[ tmpKey ] + "|" ;
                  }	
                } catch(e){}
                
              }
            }
          
          } // end if
        }catch(e){}
        quizText = quizItems[ itemId ];
        //ansObj[ quizText ] = ssAnswer;
        if  ( ! titleAr.includes( `${quizText}(${itemId})`) ){
            titleAr.push(`${quizText}(${itemId})`);
            titleAr.push( `${quizText}(score)`);
        }
        ansObj[ `${quizText}(${itemId})` ] = ssAnswer;
        ansObj[ `${quizText}(score)` ] = score;
        //ssAnswer = attempt.scored_data.value.user_response?attempt.scored_data.value.user_response:attempt.scored_data.value;
        if (debug) console.log( "step5:", {choiceItems} , {itemId}, {ssAnswer} );
      } // end for 
      //attach answerObj to student
      //let user = users[userId];
      
      //let tmpUserName = user.user.full_name;
      ansObj["full_name"] = userNameList[ userId ];
      //save answers to studentsAnswers
      studentsAnswers[ userId ] = ansObj;
      //get next student
      if (debug) console.log({sessionFetched}, {maxAttempt});
      
      getQuizAnswers();
     
      //getQuizAnswers();
    }).fail(function () {        
      getQuizAnswers();  
      throw new Error('Failed to doStep5:', attemptId, resultToken);
    });

  } // end doStep5

  





  function getToken() { //identifies course ID from URL
    
    const launchParams = unsafeWindow.launch_params;
    //access_token: "To0ACyp61L3eiir8lElOBo6raoecFD3UiAiJfSek91g", lang: "en", launch_url: "https://auckland.quiz-lti-syd-prod.instructure.com/build/8067?", … }
    console.log( {launchParams} );
    tokenId = launchParams['access_token'];
    launch_url = launchParams['launch_url'];
    try {
        var assignmentRegex = new RegExp('/build/([0-9]+)');
        var matches = assignmentRegex.exec(launch_url);
        if (matches) {
          assignmentId = matches[1];

        } else {
          throw new Error('Unable to detect assignment ID');
        }
      } catch (e) {
        errorHandler(e);
      }
    
    console.log( tokenId, launch_url, assignmentId );
    //Header: per-page:, Total:
  }

  function generateReports() {
    let batchReportData, reportData, batchTitle, tmpCourses, tmpCourseId;
    try {
      if (aborted) {
        console.log('Process aborted');
        aborted = false;
        return;
      }
      progressbar();

      var wb = XLSX.utils.book_new();
      wb.Props = {
        Title: "Student quiz answer R=reports",
        Subject:"Student quiz answer reports",
        Author: "",
        CreatedDate: new Date()
      };
      //save each reportDates into worksheet
      // var animalWS = XLSX.utils.json_to_sheet(this.Datas.animals);
      //XLSX.utils.book_append_sheet(wb, animalWS, 'animals');
      //Generate Reports tab, reportsAr, array of objects
      // date, errors, suggestions, content fixed, content resolved, courses
      
      reportData = genReportsAr();
      let newTitleAr = [ "ID", "Name" , ...titleAr ];
      let tmpWs = XLSX.utils.json_to_sheet( reportData );
      
      XLSX.utils.sheet_add_aoa( tmpWs, [newTitleAr], { origin: "A1" });
      XLSX.utils.book_append_sheet( wb, tmpWs, "All Reports" );


      let wbout = XLSX.write(wb, {bookType:'xlsx', type: 'binary'});
      let blob = new Blob([ s2ab(wbout) ], {
        'type': 'application/octet-stream'
      });
      let quizTitle=document.title.split( ":" )[0].replace(/[^\w]/g, "");
      if ( jQuery('[data-automation="sdk-quiz-title-show-title"]') ){
        quizTitle = jQuery('[data-automation="sdk-quiz-title-show-title"]').text();
      }
      let savename = `${quizTitle} Reports-${today}.xlsx`;
      saveAs(blob, savename);

      $('#download-answers').one('click', {
        type: 1
      }, allAnswers);
      resetData();


    } catch (e) {
      errorHandler(e);
    }
  }

  function genReportsAr(){


    let reportObj;
    let reportData = [];
    let tmpReportData={};
    let tmpObj;
    let tmpStudentId, tmpIndex, tmpId, tmpAns, tmpField;
    titleAr.sort();
    //let newTitleAr = [ "ID", "Name" , ...titleAr ];
    //titleAr = newTitleAr;
    ////for ( let k=0; k < reportsAr.length;k++ ){
    for ( [tmpIndex, tmpObj ] of Object.entries(studentsAnswers)) {
      console.log( {tmpObj} );
      tmpReportData = {};
      tmpStudentId = tmpIndex;
      tmpReportData["studentId"] = tmpStudentId;
      tmpReportData["name"] = tmpObj.full_name;
      
      for ( let i=0;i<titleAr.length;i++){
        
        tmpField = titleAr[i];
        console.log( "generateReports:", tmpObj[ tmpField ], {tmpField} );
        tmpReportData[tmpField] = tmpObj[ tmpField ]?tmpObj[ tmpField ]:"";
      }
      
      console.log( {tmpReportData} );
      reportData.push( tmpReportData );
      

    } // end for reportsAr


  
    return reportData;
  }


  function camel2title(text) {
    const result = text.replace(/([A-Z])/g, " $1");
    const finalResult = result.charAt(0).toUpperCase() + result.slice(1);
    return finalResult;
  }
    ////////////////////////
  function formateDate(dateStr) {
    var d;
    let tmpAr, tmpM, tmpD, tmpY;
    try {
      if (!dateStr) {
        return '';
      }
      //dateStr 5/1/23 => 05/01/23
      tmpAr = dateStr.split('/');
      tmpM = tmpAr[0];
      tmpD = tmpAr[1];
      tmpY = tmpAr[2];
      d = pad(tmpM) + '/' + pad(tmpD) + '/' + tmpY;
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
          $('body').append('<div id="jj_progress_dialog" ></div>');
          $('#jj_progress_dialog').append('<div id="jj_progressbar"></div><small>It may take a few mins to generate the report</small><br><small id="doing"></small>');
          $('#jj_progress_dialog').dialog({
            'title': 'Fetching reports',
            'autoOpen': false,
            'buttons': [
              {
                'text': 'Cancel',
                'click': function () {
                  $('#download-answers').one('click', {
                  type: 1
                }, allAnswers);
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
          var val = n > 0 ? Math.round(100 * x / n) : false;
          $('#jj_progressbar').progressbar('option', 'value', val);
        }
      }
    } catch (e) {
      errorHandler(e);
    }

  }
  function resetData(){

    pending = - 1;
    batchIndex = -1;
    fetched = 0;
    needsFetched = 0;
    reportsAr = [];
    studentsAnswers ={};
    users = [];
    userNameList = {};
    quizItems = {}; 
    choiceItems = {};
    sessionList = [];
  }

  //convert the binary data into octet
  function s2ab(s) {
    var buf = new ArrayBuffer(s.length); //convert s to arrayBuffer
    var view = new Uint8Array(buf); //create uint8array as viewer
    for (var i=0; i<s.length; i++) {
      view[i] = s.charCodeAt(i) & 0xFF; //convert to octet
    }
    return buf;
  }

  function errorHandler(e) {
    console.log(e.name + ': ' + e.message);
  }
}) ();

