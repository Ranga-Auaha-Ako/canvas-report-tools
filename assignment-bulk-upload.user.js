// ==UserScript==
// @name        Canvas assignment bulk upload script
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description Canvas assignment bulk upload script
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/assignment-bulk-upload.user.js
// @include     https://*/courses/*/assignments/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @require     https://unpkg.com/xlsx/dist/xlsx.full.min.js
// @require     https://raw.githubusercontent.com/gildas-lormeau/zip.js/master/dist/zip-fs-full.min.js
// @version     0.2
// @grant       none
// ==/UserScript==
// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement
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
  var studentIdArray = [];
  var userIdArray = [];
  var fileEntries = [];
  var fileNameArray=[];
  var courseId;
  var assignmentId;
  var sections = {};
  var debug = 0;
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
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (mm < 10) {
    mm = '0' + mm;
  }
  var excelExist = 0;
  var zipExist = 0;
  var studentsFromExcel;
  //courseId = getCourseId();
 // quizId = getQuizId(); 

  today = (yyyy-2000 ) + '-' + mm  + '-' + dd + '-' + Math.floor(Date.now() /1000) ;
  addSubmissionUploadButton();

   
    
  function addSubmissionUploadButton() {

    

    if ($('#assignment-submissionUpload').length === 0) {
        
        $('#sidebar_content').append(
            `<span><a href="javascript:void(0)" id="assignment-submissionUpload" class="ui-corner-all" role="menuitem">
                <i class="icon-analytics"></i> Bulk upload submissions or Comment</a>
            </span>
            <form id="custom_upload_submissions_form" style="margin-top: 10px; display: none;" enctype="multipart/form-data" onsubmit="return false">
                <div id="step1" style="font-size: 0.8em;">
                <p>Step 1. Choose excel file(.xslx) with student information: <a href="https://flexiblelearning.auckland.ac.nz/temp/studentsample.xlsx" target="_new">example format</a> 
                <input type="file" id="student-excel" name="student-excel">
                </p>
                </div>
                <div id="step2" style="font-size: 0.8em;display:none;">
                <p>Step 2. Choose submissions zip file:  
                <input type="file" id="student-submissions" name="student-submissions">
                </p>
                </div>
                <div>
                    <div id="myMissing" style="display:none;">
                    </div>
                    <div id="step3" class="button-container" style="display:none;">
                        Step 3. Submit file for <br>
                        <div style="padding-left:20px;">
                        <label><input type="radio" name="submissionType" value='assignment'> student</label><br>
                        <label><input type="radio" name="submissionType" value='comment'> feedback</label>
                        </div>
                    </div>
                    <div id="step4" style="display:none;">
                        Step 4 <br>
                        <button id="step4Submit" type="submit" class="btn">Proceed to upload</button> <br><br>
                        
                    </div>
                </div>
            </form>
            <div id="myProgress" style="font-size: x-small;">
            </div>
            `
            );

        
        jQuery('#step4Submit').one( 'click', myUpload );
        
        $('#assignment-submissionUpload').one('click', {
        type: 2
        }, showSubmissionUploadForm );
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

  function showSubmissionUploadForm(){
    pending = 0;
    fetched = 0;
    aborted = false;
    setupPool();
    
    //progressbar();
    pending = 0;
    courseId = getCourseId();
    assignmentId = getAssignmentId();
    if ( debug ) console.log( { courseId, assignmentId } );
    if ( !courseId || !assignmentId ){
        return;
    }
    getUserSubmissionInfo( courseId );
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
    showUploadForm();
    getStudents( url, courseId );
    
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
                        //sis_user_id ==> auid
                        studentIdArray.push( ''+user.sis_user_id );
                        userIdArray.push( ''+user.id );
                    } // end for
                } // end if length>0
                
            } catch(e){ continue; }
          
        }
        if (debug) console.log( {userData} );
        if (debug) console.log( "next url ?", url );
        //if (debug) console.log( "number ss:", studentIdAr.length );
        if (url) {
          getStudents( url, courseId );
        }
        pending--;
        if (debug) console.log( "pending:", pending );

        if (pending <= 0) {

            //showUploadForm( );

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
  
  function showUploadForm(){
    //studentInfo to record student name/Auid/fileName
    var studentInfo;
    
    jQuery('#custom_upload_submissions_form').show();
    //read student file name information from the excel file 
    $('#student-excel').change(function (evt) {
        let tmpFileName = evt.target.files[0].name;
        if ( tmpFileName.toLowerCase().split('.').pop()!='xlsx' ){
            alert( 'Please choose an excel file(.xslx) ' );
            return;
        } else {
            let reader = new FileReader();
               
            reader.readAsArrayBuffer(evt.target.files[0]);
            // let rABS = typeof FileReader !== 'undefined' && FileReader.prototype && FileReader.prototype.readAsBinaryString;
            //console.log({rABS});
            reader.onload = function (e) {
                let data = e.target.result;
                data = new Uint8Array(data);
                let workbook = XLSX.read(data, {
                    type: "array"
                });
               
                
                if (debug) console.log(workbook);
                let first_worksheet = workbook.Sheets[workbook.SheetNames[0]];
                // console.log(first_worksheet);
                studentsFromExcel = XLSX.utils.sheet_to_json(first_worksheet, {header:1});
                if (debug) console.log( studentsFromExcel );
                // studentsFromExcel[0] should be an array of 'name', 'auid', 'file name'
                if ( 
                 studentsFromExcel[0][1].toLowerCase()=="auid" && 
                 studentsFromExcel[0][2].toLowerCase().replace(/[_ ]+/g, "").trim()=="filename" ){
                    excelExist = 1;
                } else if ( 
                 studentsFromExcel[0][1].toLowerCase()=="user_id" && 
                 studentsFromExcel[0][2].toLowerCase().replace(/[_ ]+/g, "").trim()=="filename" ){
                    excelExist = 1;
                    useUserId = 1;
                    if (debug) console.log({useUserId});
                } else {
                    alert( "excel file format is wrong. Make sure the first row contains 'name', 'auid', 'file name' " );
                }
                
                
                //name, auid, file
                // display students in the class who not included in the file

            }   
        }
        fileConsistancyCheck();
        jQuery("#step2").show();
      } );
    
      $('#student-submissions').change( async function (evt) {
        let tmpFileName = evt.target.files[0].name;
        if ( tmpFileName.toLowerCase().split('.').pop()!='zip' ){
            alert( 'Please choose a zip file(.zip) ' );
            return;
        } else {
            let reader = new FileReader();
            var selectedFile = evt.target.files[0];
            if (debug) console.log({selectedFile});
            //reader.onload = function (evt) {
                //var data = evt.target.result;
                let tmpreader =  new zip.ZipReader(new zip.BlobReader(selectedFile));

                // get all entries from the zip
                fileEntries = await tmpreader.getEntries();
                for (let i=0;i<fileEntries.length;i++){
                    fileNameArray.push( fileEntries[i].filename );
                }
                if (debug) console.log({fileEntries});
                if (fileEntries && fileEntries.length) {
                   if (debug) console.log( {fileEntries} );
                }
                zipExist = 1;
                
           // };
        }
        fileConsistancyCheck();
      } );

      jQuery("input[name='submissionType']").change(function(){
          jQuery('#step4').show();
      });
      //jQuery('#step4Submit').one( 'click', myUpload );
      // if both files presented, check file name consistancy ( if missing file(s), display error and stop the process )

      // process to upload each file, present progress on screen.

    
  }
  
  //if excel/zip files exist, check students, file names 
  function fileConsistancyCheck(){
    if (excelExist && zipExist){
        if (debug) console.log('passed file check');
        checkStudents();
        checkFiles();
    } else {
        return 0;
    }
    
  }

  function checkStudents(){
    //display if any students not included in the spreadsheet, 
    let studentNotInCourse = [];
    let studentsNotInExcel = [];
    let missingStr = '';
    //excel header row no need to check
    for ( let i=1; i<studentsFromExcel.length; i++ ) {
        if ( useUserId ){
          //use canvas user_id
          let tmpId = ''+studentsFromExcel[i][1];
          if ( userIdArray.includes( tmpId ) ){
              userIdArray = userIdArray.filter((value)=>value!=tmpId);
              
          } else {
              studentNotInCourse.push( studentsFromExcel[i][1] +'('+ studentsFromExcel[i][0] + ')<br>' );
          }
          studentsNotInExcel = userIdArray;
        } else {
          //user auid
          let tmpId = ''+studentsFromExcel[i][1];
          if ( studentIdArray.includes( tmpId ) ){
              studentIdArray = studentIdArray.filter((value)=>value!=tmpId);
              
          } else {
              studentNotInCourse.push( studentsFromExcel[i][1] +'('+ studentsFromExcel[i][0] + ')<br>' );
          }
          studentsNotInExcel = studentIdArray;
        } // end if useUserId
        
    } // end for studentsFromExcel
    if ( studentsNotInExcel.length>0 ){
      missingStr+='<h3>Students not included in the upload:</h3>';
      for ( let i=0; i<studentsNotInExcel.length;i++){
          let tmpId = studentsNotInExcel[i];
          if (!useUserId){
            missingStr += userData[tmpId].name + '('+ tmpId + ')<br>';
          } else {
            missingStr += userDataUserId[tmpId].name + '('+ tmpId + ')<br>';
          }
      }
    }
    if ( studentNotInCourse.length>0 ){
      missingStr+='<h3>Students not in the course:</h3><br>';
      missingStr += studentNotInCourse.join("");
    }
    
    
    if (debugCheckStudents) console.log( {studentIdArray} );
    if (debugCheckStudents) console.log( {studentNotInCourse} );
    if (missingStr!=''){
        
        jQuery('#myMissing').html( missingStr ).css( { 'border':'1px solid #ccc', 'padding':'3px' } );
    }
    jQuery("#step3").show();
    
  }
  
  function checkFiles(){
      //check and display file name consistance among excel and zip file
    let missingFiles = [];
    let missingFileStr = '';
    for ( let i=1; i<studentsFromExcel.length; i++ ) {
        let tmpFile = studentsFromExcel[i][2];
        if ( ! fileNameArray.includes( tmpFile ) ){
            
            missingFiles.push( studentsFromExcel[i][0] +"("+ tmpFile + ")" );
        }
    } 
    if ( missingFiles.length> 0 ) {
        missingFileStr = "<h3>Missing files:</h3><br>" + missingFiles.join( "<br>" );
        jQuery('#myMissing').html( jQuery('#myMissing').html() + missingFileStr );
        //jQuery('#step4Submit').attr('disabled',true);
        //jQuery('#step4').hide();
    }
    if ( jQuery('#myMissing').html()!="" ){
        jQuery('#myMissing').after(`<p><a id="toggleMissing" type="cancel" class="btn" >show missing students/files</a></p><button id="myCancel" type="cancel" class="btn" >Cancel</button><br>`);
        jQuery('#myCancel').one( 'click', myCancel );
        jQuery('#toggleMissing').on( 'click', function(){jQuery('#myMissing').toggle()} );
        jQuery('#myMissing').hide();
    }
    
  }
  async function myUpload(){
    //to upload assignments or comment files
    
    if ( jQuery("input[name='submissionType']:checked").val()=="assignment" ){
        uploadType = 0;
    }else if ( jQuery("input[name='submissionType']:checked").val()=="comment" ){
        uploadType = 1;
    }
    if (debug) console.log({uploadType});
    window.onbeforeunload = confirmExit;
    displayStudentProgressList();
    uploadFile( );
    //for ( let i=1; i<studentsFromExcel.length;i++){
    
        //uploadFile( 1 );
    //}
  
  }

  async function uploadFile( ){
      let showUnfinished=`<a id="showUndone" class="btn" >show students not finished</a>`;
      if ( targetI > (studentsFromExcel.length-1) ){
        if (jQuery('.Button--danger').length>0){
          jQuery("#progressStatus").html( "<h3>All done !!</h3>"+showUnfinished );
          jQuery('#showUndone').on( 'click', function(){
            jQuery('.progressStudent').toggle();
            jQuery('.Button--danger').show();
            return false;
          } );
        } else {
          jQuery("#progressStatus").html( "<h3>All done !!</h3>" );
        }
        
        
        console.log( "ALL DONE!!" );
        alert( 'Upload process finished!' );
        window.onbeforeunload = null;
        return false;
      } else if (!doing) {
        let tmpUrl = '';
        
        let targetFile;
        let retJson1;
        let retJson2;
        let tmpId='';
        if ( !useUserId ){
          let tmpAuid = ''+ studentsFromExcel[targetI][1];
          if (debug) console.log({tmpAuid});
          if (debug) console.log(userData[tmpAuid]);
          
          //get canvas id from auid
          try{
            let element = userData[tmpAuid];
            tmpId = element.id;
          }catch(e){}
        } else {
          tmpId = ''+ studentsFromExcel[targetI][1];
        }
        
        if (debug) console.log({tmpId});
        if (uploadType==-1 || tmpId==''){
            return;
        }
        
        if ( uploadType == 1 ){ 
          tmpUrl =  `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${tmpId}/comments/files`;
        } else if ( uploadType == 0 ){ 
          tmpUrl =  `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${tmpId}/files`;
        }
        if (debug) console.log( '1st api url:', tmpUrl);
        //prepare data
        let formData = new FormData();
        formData.append('on_duplicate', 'overwrite' );
        
        formData.append( 'name', studentsFromExcel[targetI][2]  );

        
        //get the zip file size
        let fIndex = fileNameArray.indexOf(studentsFromExcel[targetI][2]);
        if ( fIndex >-1 ){
            targetFile = await fileEntries[fIndex];
            if (debug) console.log({targetFile});
            //data['size'] = targetFile.uncompressedSize;
            //formData.append( 'size', targetFile.uncompressedSize );
            
        }
        doing  =1;
        let tt = jQuery("input[name='authenticity_token']").val();
        formData.append( "authenticity_token", tt );
        jQuery.ajax({
          url: tmpUrl, // We'll send to our Web API UploadController
          data: formData, // Pass through our fancy form data
          //headers: {"Authorization": "Bearer xxxxxxxxxxxx"},
          // To prevent jQuery from trying to do clever things with our post which
          // will break our upload, we'll set the following to false
          cache: false,
      
          // We're doing a post, obviously.
          type: 'POST',
          contentType: false,
          processData: false,
          
          success: function ( udata ) {
              //phase 1 success
              jQuery( '#progress' + targetI ).val( 33 );
              if (debug) console.log( 'phase 1 success:', udata );
              uploadFileStep2( udata, targetFile );
              
              
          }
        }).fail(function() {
          if (debug) console.log( tmpUrl + " upload process error" );
          //jQuery( '#progress' + targetI ).css( {"background-color": "red"} );
          jQuery( '#progress' + targetI ).addClass('Button--danger');
          nextUpload();
        });
        
      } // end targetI check
  } // end function uploadFile

 
  async function uploadFileStep2( udata, targetFile ){
        if (! targetFile ){
          if (debug) console.log( 'targetFile not exist'  );
          //jQuery( '#progress' + targetI ).css( {"background-color": "red"} );
          jQuery( '#progress' + targetI ).after( "file not exist" );
          jQuery( '#containerprogress' + targetI ).addClass('Button--danger');
          nextUpload();
          return false;
          
        }
        let retJson;
        try {
            retJson = jQuery.parseJSON( udata );
        }catch(e){
            retJson = udata;
        }
        
        let uploadUrl = retJson['upload_url'];
        if (debug) console.log( 'step 2 uploadUrl:', uploadUrl );
        let formData1 = new FormData();
        formData1.append('filename', retJson['upload_params']['filename']);
        formData1.append('content_type', retJson['upload_params']['content_type']);
        //read the content of the entry
        
        let tmpData = await targetFile.getData(new zip.BlobWriter()) ;
        
        try {
          formData1.append('file', tmpData );
        } catch(e){
          if (debug) console.log( retJson['upload_params']['filename'], ' not exist'  );
          //jQuery( '#progress' + targetI ).css( {"background-color": "red"} );
          jQuery( '#progress' + targetI ).after( "file issue" );
          jQuery( '#containerprogress' + targetI ).addClass('Button--danger');
          nextUpload();
          return false;
        }
        
        jQuery.ajax({
            url: uploadUrl, // We'll send to our Web API UploadController
            data: formData1, // Pass through our fancy form data
    
            // To prevent jQuery from trying to do clever things with our post which
            // will break our upload, we'll set the following to false
            cache: false,
        
            // We're doing a post, obviously.
            type: 'POST',
            contentType: false,
            processData: false,
            success: function ( udata1 ) {
                if (debug) console.log( 'step 2 success: ', {udata1}); 
                jQuery( '#progress' + targetI ).val( 66 );
                uploadFileStep3( udata1 );

            },complete: function(resp){
              if (debug) console.log(resp.getAllResponseHeaders());
            }
        }).fail(
          function() {
            if (debug) console.log( uploadUrl + " upload process error" );
            //jQuery( '#progress' + targetI ).css( {"background-color": "red"} );
            jQuery( '#progress' + targetI ).after( "file upload error" );
            jQuery( '#containerprogress' + targetI ).addClass('Button--danger');
            nextUpload();
            //doing=0;
            //targetI +=1;
            //uploadFile();
        }).always(
          function(jqXHR, textStatus) {
            formData1 = null;
            tmpData = null;
            targetFile = null;
            if (debug) console.log('status', textStatus);
        });
  }

  function uploadFileStep3(udata){
    //submit assignment or post to comment
    let tmpUrl;
    let tmpId="";
    let submitType='';
    if (debug) console.log('step3', udata );
    let retJson;
    try {
        retJson = jQuery.parseJSON( udata );
    }catch(e){
        retJson = udata;
    }
    let file_id = udata.id;
    if (!useUserId){
      let tmpAuid = ''+ studentsFromExcel[targetI][1];
      try{
          let element = userData[tmpAuid];
          tmpId = element.id;
      }catch(e){}
    } else {
      tmpId = ''+ studentsFromExcel[targetI][1];
    }
    
    if ( file_id=="" || tmpId==""){
      
      if (debug) console.log( "empty auid or empty file_id for target index:", targetI  );
      //upload next one
      //jQuery( '#progress' + targetI ).css( {"background-color": "red"} );
      jQuery( '#containerprogress' + targetI ).addClass('Button--danger');
      nextUpload();
      //targetI +=1;
      //uploadFile();
      return;

    } else {
      
      var formData = new FormData();
      formData.append( 'course_id', courseId );
      formData.append( 'assignment_id', assignmentId );
      if ( uploadType == 1 ){ 
        tmpUrl =  `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${tmpId}`;
        formData.append( 'user_id', tmpId );
        
        formData.append( 'comment[text_comment]', 'Your marked and annotated assignment is attached' );
        formData.append( 'comment[file_ids][]', file_id );
        
        submitType = 'PUT';
        
      } else if ( uploadType == 0 ){ 
        tmpUrl =  `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`;
        formData.append( 'submission[submission_type]', 'online_upload' );
        formData.append( 'submission[file_ids][]', file_id );
        formData.append( 'submission[user_id]', tmpId );
        submitType = 'POST';
      }
      if (debug) console.log( 'step3 apiUrl:', tmpUrl );
      
      
      let tt = jQuery("input[name='authenticity_token']").val();
      formData.append( "authenticity_token", tt );
      jQuery.ajax({
          url: tmpUrl, // We'll send to our Web API UploadController
          //headers: {"Authorization": "Bearer xxxxxxxxxxxx"},
 
          type: submitType,
          data: formData,
          contentType: false,
          processData: false,
          success: function ( ) {
              jQuery( '#progress' + targetI ).val( 100 );
              jQuery( '#uploadProgress'  ).val(  targetI );
              jQuery( '#numFinished'  ).html(  targetI );
              
              console.log( 'step3 success:', targetI ); 
              formData = null;
              nextUpload();
              //doing=0;
              //targetI +=1;
              //uploadFile();

          }
      }).fail(function() {
          if (debug) console.log( "step 3 POST process error for target index:", targetI );
          
          //jQuery( '#progress' + targetI ).after( "update assignment error" );
          jQuery( '#progress' + targetI ).css( {"background-color": "red"} );
          jQuery( '#containerprogress' + targetI ).addClass('Button--danger');
          formData = null;
          nextUpload();
          //targetI +=1;
          //doing = 0;
          //uploadFile();
      });

    }
   
    
    
    
  }

  function nextUpload(){
    doing=0;
    targetI +=1;
    uploadFile();
  }

  function myCancel(){
    resetData();
    jQuery('#step2').hide();
    jQuery('#step3').hide();
    jQuery('#custom_upload_submissions_form').hide();
    location.reload();
    return false;
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


  function resetData(){
    userData = {};
    studentIdArray = [];
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
