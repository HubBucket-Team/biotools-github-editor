import GitHub from "github-api";
import Repository from "github-api";
import $ from "jquery";
import request from "superagent";
//import bar, { foo } from "./fonctions"; // Tests
//import fs from "fs"; // TEMP: TO READ LOCAL OAUTH FILE 

//foo() // Tests
//bar() // Tests

// ///////////////////////////////////
// Github authentification:

// Use a personal github OAUTH token
//var OAUTH = fs.readFileSync('./src/OAUTH', 'utf8');
//OAUTH = OAUTH.substring(0, OAUTH.length-1);

// Use OAUTH asked and stored by log page
const OAUTH = sessionStorage.getItem("access_token");

// If the user is here without OAUTH token, redirect to connexion page
console.log("/!\\-token-/!\\");
console.log(OAUTH);
console.log("/!\\-------/!\\");
if(!OAUTH){
	location.href = "index.html";
}

//console.log(OAUTH);

// Basic auth
var gh = new GitHub({
  //username: 'ValentinMarcon',
  token: `${OAUTH}`
});

// Get user info
var login="";
gh.getUser().getProfile(function(err, profile) { 
		if(!profile){
			alert("Authentication failure with token ");
			location.href = "index.html";
		}
		else {
			login = profile["login"];
			var avatar = profile["avatar_url"];
			var $login = $('#username');
			var $avatar = $('#avatar');
			$login.text(login);
			$avatar.attr('src', avatar);
		}
});

// Get the repo where tools.json are stocked
var repo = gh.getRepo('ValentinMarcon','TESTAPI');

// Init metadata var
// It is a variable to stock all data that we don't want to add to JSON file
var tools_metadata={};


// ///////////////////////////////////
// Buttons events:
// TODO: Create function if redondant

var $btn_search = $('.btn_search');
var $btn_select = $('.btn_select');
var $btn_search_other = $('.btn_search_other');
var $btn_send = $('.btn_send');
var $btn_cancel = $('.btn_cancel');

$btn_search.on('click', function(event) {
	// Input text to search a tool
	search_tool($('#search_tool'));
});

$btn_select.on('click', function(event) {
	// Select tag to choose the tool to search
	search_tool($('#tool_list'));
});

$btn_search_other.on('click', function(event) {
	search_mode();
});

$btn_send.on('click', function(event) {
	send_modif();
});

$btn_cancel.on('click', function(event) {
	exit_modif();
	change_tab(get_stored_entry()['biotoolsID'].toLowerCase());
});

/// ///////////////////////////////////
// Menu events:

function add_tab_event(){
    var $tab_not_active = $("li:not('.active')");
    $tab_not_active.unbind('click').on('click', function(event){
        change_tab(this.id);
    });
}
add_tab_event();

// ///////////////////////////////////
// Fill the tool list:
fill_tool_list();

// ///////////////////////////////////
// Autocomplete TODO  WIPWIPWIP TODO (JQUERY PROBLEMS)
/*
var availableTags = [
      "ActionScript",
      "AppleScript",
      "Asp",
      "BASIC",
      "C",
      "C++",
      "Clojure",
      "COBOL",
      "ColdFusion",
      "Erlang",
      "Fortran",
      "Groovy",
      "Haskell",
      "Java",
      "JavaScript",
      "Lisp",
      "Perl",
      "PHP",
      "Python",
      "Ruby",
      "Scala",
      "Scheme"
 ];

var $search_tool = $('#search_tool');
console.log($search_tool);
('#search_tool').autocomplete({
     source: availableTags
});
*/

// ////////////////////////////////////////////////////
// FUNCTIONS :
// ////////////////////////////////////////////////////

// /////////////////
// LOADER

function show_loader(){
	var $loader = $('#search_loader');
	$loader.show();
}
function hide_loader(){
	var $loader = $('#search_loader');
	$loader.hide();
}

// /////////////////
// SEARCH_TOOL
// Search a tool entry from the github repository
//

function search_tool($search_tool,_cb){
	// Value entered/choosed by the user
	var tool_name = $search_tool.val()
	if (tool_name != ""){
		show_loader();
		// Get the corresponding json file on the data repository on Github (Cf Github authentifiation above)
		repo.getContents('master','data/'+tool_name+'/'+tool_name+'.json',true, function(req, res) {
			if (!res) {
				alert("This tool '"+tool_name+"' do not exist on bio.tools. You can also pick one in the list above");
				hide_loader();
				return;
			}
			else {
				modif_mode();
				// Store the master json entry in memory to manipulate the entry later
				store_entry(res);
				// Print the master entry into html
				print_branch_content(res,tool_name);
				// Search and print the other version of the entry into other tabs
	       			search_other_tool_version(tool_name);
				hide_loader();
			}
        	});
	}
	else {
		alert("Enter a tool name. You can also pick one in the list above");
	}
}

// /////////////////
// PRINT_BRANCH_CONTENT
//
// TODO : WRITE doc

function print_branch_content(entry,name){
	  // Store the original json entry in memory to manipulate the entry later
	  store_entry(entry,name);
	  //console.log("entry: "+name);
	  // Store the current mode to "print"
	  store_entry("print","mode");
	  // Store the current state of changes to false
    	  store_entry(false,"changes");
	  //store_modif([]); //WIP: Try to store the modif added to the tool
	  print_tool(entry);
	  create_tabs(name);
}

// /////////////////
// SEARCH_OTHER_TOOL_VERSIONS
//
// TODO : DOC
// TODO : STOP WRITE ALL THE VERSION TO ERASE EACH OTHERS UNTILL THE LAST (Need to learn promise and callback)
//
// TODO : TRIER PAR NUM DE PR
//

function search_other_tool_version(tool_name){
        repo.listPullRequests({},function(req, res) {
           res.forEach(function(pullrequest){
		var branch_name=pullrequest['head']['ref'];	
		var branch_name_lc=branch_name.toLowerCase();
                var regex = new RegExp("^.*_(" + tool_name + "_.*)$");
		if (regex.test(branch_name_lc)){
			var pr_number=pullrequest['number'];
			var pr_link=pullrequest['html_url'];
			var repo_user=pullrequest['head']['repo']['owner']['login'];
			var repo_name=pullrequest['head']['repo']['name'];
			var new_name = "PR_"+pr_number+"_"+tool_name;
			// INIT tools_metadata[id_tool]
			tools_metadata[new_name]={};
			tools_metadata[new_name]['pr_user']=repo_user;
			tools_metadata[new_name]['pr_link']=pr_link;
			var my_repo = gh.getRepo(repo_user,repo_name);
		        get_branch_content(branch_name,tool_name,my_repo,function(entry) {
				if(entry){
					print_branch_content(entry,new_name);
				}
			});
		}
           });
	});

}

// /////////////////
// GET_BRANCH_CONTENT
//
// TODO : DOC

function get_branch_content(branch_name,tool_name,my_repo,_callback){
	my_repo.getContents(branch_name,'data/'+tool_name+'/'+tool_name+'.json',true, function(req, res) {
		if (!res) {
			console.log('Error getting content of ' + branch_name);
      			return;
		}
		else{
			_callback(res);
		}
	});
}

// /////////////////
// PRINT_TOOL
// Print all json values into a table (html)
//
// TODO : Manage new content 

function print_tool(entry){
	// Select table to add the tool content
	var $tool_content = $('#tool_content');
	// Erase content
	$tool_content.html("");
	// For every data of the tool entry, print it in a line in the table
	for (var key in entry) {
	    if (entry.hasOwnProperty(key)) {
		var new_line = ""
		new_line += "<tr>"
		new_line += val_to_table(key)
		new_line += val_to_table(entry[key],key)
		new_line += "</tr>"
		$tool_content.append(new_line);
	    }
	}
	$tool_content.append("<tr><td class=new_line id="+key+" colspan=2>➕ New Line </td></tr>" ); //WIPP
	// Change the title with the tool name
	var $title = $('p#title');
	$title.text(entry['biotoolsID'])
	// Table cell that could be modified are selected thanks to the id "value"
	//var $modifcell = $('p.value');
	var $modifcell = $('td.edit');
        $modifcell.on('click', function(event) {
	    modif_value(this.id.replace('_status', ''));
        });
	// Table cell that could have a new entry are selected thanks to the id "new"
	/*var $newcell = $('p.new');
        $newcell.on('click', function(event) {
	    //alert("you can't add a new value for now");
	    // WIP
	    modif_value(this.id.replace('_status', '')); 
        }); // DEPRECATED*/
	//WIP WIP WIP WIP
	var $new_line = $('td.new_line');
	$new_line.on('click', function(event) {
	    // WIP
	    this.innerText="➕ WIP⚠️";
        });
	//WIP WIP WIP WIP

}

// /////////////////
// VAL_TO_TABLE 
// Recursive function to create table cells 
// according to the format of the entry
// (Null/""; Array; String; Dict)
//

function val_to_table(entry,id=""){
	var value_to_print="";
	// If there is an empty entry, create a cell with the 'new' class and a cell with a blank indicator
	if ((entry == "") || (entry == null)){
		var val=""
		if (entry == null){
		  val="null"
		}
		else if (Array.isArray(entry)){
		  val="[]"
		}
		else {
		  val="empty"
		}
	        value_to_print += "<td class=edit id=\""+id+"_status\">✍️</td>";
		value_to_print += "<td class=none><p id=\""+id+"\" class=new>"+val+"</p></td>"
	}
	// If the entry is an array, create a new inner table and recall the function for every sub-entry
	else if (Array.isArray(entry)){
		value_to_print += "<td class=content colspan=2><table>";
		for (var key in entry) {
			 value_to_print += "<tr>"
			 value_to_print += val_to_table(entry[key],id+"___"+key)
			 value_to_print += "</tr>"
		}
		value_to_print += "<tr><td class=new_line id="+id+" colspan=2>➕ New Line</td></tr>" //WIPP
		value_to_print += "</table></td>";
	}
	// If the entry is a string:
	//   IF "id" is empty it mean that this is the key ('label' class) 
	//   ELSE create a cell with the 'value' class and a blue indicator (meaning 'unmodified')
	else if (typeof entry == "string"){
		if (id == ""){
		    value_to_print += "<td class=label>";
                    value_to_print += entry;
		    value_to_print += "</td>";
		}
		else {
	            value_to_print += "<td class=edit id=\""+id+"_status\">✏️</td>";
		    value_to_print += "<td class=content id=\""+id+"_td\">"
		    value_to_print += "<p id=\""+id+"\" class=value>";

			//TODO En faire une fonction :
			// Faire regex
			// Si ~http://edamontology.org faire un lien <A>
			//
	        	var regex_website=/^http[s]?:\/\/\S*$/;
                	// Start with 'http(s)://' and don't have whitespace after (i.e. no other words)
			if (regex_website.test(entry)){
		    		entry="<a href=\"" + entry + "\" target=\"_blank\">" + entry + "</a>";
			}

		    value_to_print += entry;
		    value_to_print += "</p></td>";
		}
	}
	// Else, entry is (probably) a dict, recall the function
	else{
		value_to_print += "<td class=content colspan=2><table>"
		for (var key in entry) {
			value_to_print += "<tr>"
			value_to_print += val_to_table(key)
			value_to_print += val_to_table(entry[key],id+"___"+key)
			value_to_print += "</tr>"
		}
		value_to_print += "<tr><td class=new_line id="+id+" colspan=2>➕ New Line</td></tr>" //WIPP
		value_to_print += "</table></td>"

	}
	return value_to_print;
}

// /////////////////
// MODIF_DICT 
// Recursive function to add modif made by the user 
// to the dict loaded from the github json.
// In input its take the dict (entry), the current position on the dict (pos),
// the table of position to have the position of the entry if its a complex dict (tab_pos),
// the value to add to the dict (value).
//

function modif_dict(entry,pos,tab_pos,value){
	var new_tab_pos=tab_pos;
	new_tab_pos.shift();
	var new_entry=entry;
	// While we don't arrived to the end of the table we relaunch the function with next pos entry (deeper in the dict) 
	if (new_tab_pos.length != 0) {
		new_entry[pos]=modif_dict(new_entry[pos],tab_pos[0],new_tab_pos,value);
	}
	// Here we arrived to the position to insert the value
	// We insert it and return then the entry modified
	else {
		new_entry[pos]=value;
	}
	return new_entry
}

// /////////////////
// MODIF_VALUE 
// 
// TODO : If we change a value two time keep the signal that it is new
// TODO : Finish the doc 

function modif_value(id){
    var motif =  /___/;
    // Get the position liste of the value from the id (Cf. "val_to_table")
    var liste = id.split(motif);
    // Select the tag with this id
    var $value = $('#'+id);
    // Get the original value on this tag
    var orig_v = $value.text();    // TODO MV $v v

    //Change mode to "modif"
    edit_mode(function(){
      // Transform the tag to an input with the original value
      var new_html = ""
      new_html += "<input style='width:100%' type=\"text\" id=\""+id+"\" class=value_edit value=\""+orig_v+"\">";//</td>";
      // Re-select the tag with this id
      var $value = $('#'+id);
      $value.replaceWith(new_html);
      // Change the indicator status to have a clickable symbol to validate the modification
      var $value_status = $('#'+id+'_status');
      var new_html = "<td id=\""+id+"_status\" class=valid >✔️</td>";
      $value_status.replaceWith(new_html);
      var $value_status = $('#'+id+'_status');
      // Function to manage modification of the value
      $value_status.on('click', function(event) {
        var $value_new = $('#'+id);
        var new_v = $value_new.val();

	// If the value is different from the original
	// we store it and change the status to "new"
	if (orig_v != new_v ){
	    // Retrieve stored entry
            var entry_id = $('li.active').attr('id');
	    var entry=get_stored_entry(entry_id);
	    //var liste_modif=Array.from(liste); // WIP
            entry = modif_dict(entry,liste[0],liste,new_v)
    	    store_entry(entry,entry_id);
            // Changes have been made, we record the status to true and show the btn to send changes into PR
	    store_entry(true,"changes");
            var $btn_send=$('input.btn_send');
            var $btn_cancel=$('input.btn_cancel');
            $btn_send.show();
            $btn_cancel.show();

	    // WIP WIP WIP WIP WIP WIP WIP WIP WIP WIP WIP
	    //var modif_entry=get_stored_modif();
	    //var modif_object = [];
	    //modif_object[liste_modif[0]]=entry[liste_modif[0]];
	    //modif_object=modif_dict(modif_object,liste_modif[0],liste_modif,$v);
            //modif_entry.push(modif_object);
	    //store_modif(modif_entry);
	    // WIP WIP WIP WIP WIP WIP WIP WIP WIP WIP WIP
            var new_status = "✏️🆕";
	    var new_class = "modified_cell";
	}
	// Else we keep original status
	else {
	    var new_status = "✏️";
	    var new_class = "value";
	}

	var new_html = "";
        new_html += "<p id=\""+id+"\" class=\""+new_class+"\" >";
        new_html += new_v;
        new_html += "</p>";//</td>";
        $value_new.replaceWith(new_html);

        var $value_status = $('#'+id+"_status");
        var new_html = "";
        new_html += "<td class=edit id=\""+id+"_status\">"+new_status+"</td>";
        $value_status.replaceWith(new_html);

	// Rebind the modif function to the tag
        var $modifcell = $('td.edit');
	$modifcell.unbind('click').on('click', function(event) {
	    modif_value(this.id.replace('_status', ''));
        });
      });
    });
}


// /////////////////
// EDIT_MODE 
// 
//
// TODO : Finish the doc 

function edit_mode(_cb){
    if (get_stored_entry("mode") != "edit"){
	store_entry("edit","mode");
        var current_tool = $('li.active').attr('id');
        console.log(current_tool +" : edit mode")
        var edit_tool = "edit_"+current_tool;
    	store_entry(get_stored_entry(current_tool),edit_tool);
        add_tab(edit_tool,"✏️"+current_tool);
        change_tab(edit_tool);
    }
    _cb();
}




// /////////////////
// SEND_MODIF
// 1) Get the stored entry (modified by the user)
// 2) Fork the bio.tools repo into user github
// 3) Create a new branch on the github repo from the "dev" branch
// 4) Write a file in this new branch with this new entry
// 5) Make a pull request to the dev branch
//
// TODO : IMprove user experience and error management (learn to use promise)
//

function send_modif(){
	var repo_name="TESTAPI" // TODO Global variable?

	// If we are here but no changes have been made don't create a pull request
	if (!get_stored_entry("changes")){
		return;
	}
	var confirm_fork=confirm("If you don't have the repo '"+repo_name+"' forked on your account the app will do it for you. Do you allow it?"); //TODO checker si le repo existe déja
	if (!confirm_fork){
		return;
	}
	show_loader();	
	// 1)
	// Find the id of the current tool edited
        var current_tool = $('li.active').attr('id');
	var entry=get_stored_entry(current_tool);
	console.log(entry+" changes will be recorded");
	// Lower Case id of the tool
	var tool_name=entry['biotoolsID'].toLowerCase();
	// File name in which changes will be saved
	var file_name=tool_name+".json";
	// Path of the file in github
	var file_path="data/"+tool_name+"/"+file_name;
	// Current date
	var d = new Date();
        var now=d.getFullYear()  + "-" + (d.getMonth()+1) + "-" +  d.getDate() + "-" + d.getHours() + "-" + d.getMinutes() + "-" + d.getSeconds() + "-" + d.getMilliseconds();
	// Branch name with current date and 'new' tag
	var branch_name="new_"+tool_name+"_"+now;
	// Origin branch in which the Fork and Pull Request will be done
	var branch_origin="dev";
	// Convert the entry to JSON to record it on the json file
	var my_bt_entry=JSON.stringify(entry, null, " ");

	// 2)
	// Fork the repo into registered user github
	repo.fork(function(req,res){
		// Retrieve then the forked repo
		var repo_forked = gh.getRepo(login,repo_name);

		// 3)
		// Create the new branch on the forked repo
		repo_forked.createBranch(branch_origin,branch_name,function(req,res){
			if (!res) {
				console.log("Error creating branch '"+branch_name+"' from '"+branch_origin+"'");
			}
			else {

				// 4)
				// Create the json file on this new branch on the forked repo
				repo_forked.writeFile(branch_name,file_path,my_bt_entry,'Write in '+file_name,{},function(req,res){
					if (!res) {
						console.log("Error creating file '"+file_name+"' in '"+branch_name+"'");
					}
					else {

						// 5)
						// Create Pull Request from the new branch on the repo forked to the base repository dev branch
						var result=repo.createPullRequest({
					  		"title": "Update/create "+file_name,
					  		"body": "Please pull this in!",
					  		"head": login+":"+branch_name,
					  		"base": branch_origin
						},function(req,res){
							if (!res) {
								console.log("Error creating Pull Request from '"+login+":"+file_name+"' to origin:'"+branch_origin);
							}
							else {
								alert("File writed in https://github.com/"+login+"/"+repo_name+"/tree/"+branch_name+"/"+file_path);
								hide_loader();	
								exit_modif();
								var pr_number=res["number"];
								var new_name="NEW_PR_"+pr_number+"_"+tool_name;
								tools_metadata[new_name]={}
								tools_metadata[new_name]['pr_link']=res["html_url"];
								print_branch_content(entry,new_name);
							}
						});
					}
				});
			}
		});
	});
}

// /////////////////
// MODIF_MODE 
// - Hide the search table
// - Show the modif table
//

function modif_mode(){
	var $search_table = $('.search_table');
	$search_table.hide();
	var $modif_table = $('.modif_table');
	$modif_table.show();
	var $tab_menu = $('#menu');
	$tab_menu.show();

}

function exit_modif(){
	store_entry("print","mode");
	store_entry(false,"changes");
        var $btn_send = $('.btn_send');
	$btn_send.hide();
	var $btn_cancel = $('.btn_cancel');
	$btn_cancel.hide();
	remove_tab();
}


// /////////////////
// SEARCH_MODE 
// - Show the search table
// - Hide the modif table
// - Empty the tool content tag
// - Delete the tabs
// - Change to "print" mode
// - Change to no (false) changes
// - Hide "send modif" button
//

function search_mode(){
	var $tool_content = $('#tool_content');
	$tool_content.html("");
	var $title = $('p#title');
	$title.text("SEARCH A TOOL");
	var $search_table = $('.search_table');
	$search_table.show();
	var $modif_table = $('.modif_table');
	$modif_table.hide();
	var $tab = $('#tab');
	$tab.html("");
	var $tab_menu = $('#menu');
	$tab_menu.hide();
	store_entry("print","mode");
	store_entry(false,"changes");
        var $btn_send = $('.btn_send');
        var $btn_cancel = $('.btn_cancel');
	$btn_send.hide();
        $btn_cancel.hide();
	hide_loader();
}


// /////////////////
// GET_STORED_ENTRY 
// Recover the stored "biotools_entry" 
//

function get_stored_entry(name="new_entry"){
	var stored=sessionStorage.getItem(name);
	if (stored) return(JSON.parse(stored));
	else return false; // TODO manage this false return for callers
}

// /////////////////
// STORE_ENTRY 
// Save the "biotools_entry" 
//

function store_entry(entry,name="new_entry"){
	    sessionStorage.setItem(name,JSON.stringify(entry));
}

// /////////////////
// FILL_TOOL_LIST 
// Get the list of tool from the index file 
// Append the tools name as options of the select section "tool_list"
//
// TODO : Finish the doc & manage requestsuccessornot

function fill_tool_list(){
	var $tool_list_obj = $('#tool_list');
	repo.getContents('master','index.txt',true, function(req, res) {
		var tools = res.split("\n");
		tools.pop();
		for (var tool in tools) {
		    $tool_list_obj.append("<OPTION>"+tools[tool]);
		}
		var $btn_select = $('.btn_select');
		$btn_select.show();
		var $option_not_found = $("#tool_list option[id='not_found']");
		$option_not_found.remove();
	});
}


// /////////////////
// ADD_TAB
//
// TODO: Finish the doc
function add_tab(id,value=id){
	var $tab = $('#tab');
        var regex = new RegExp("^(PR|edit|NEW)_[a-zA-Z0-9_-]*$");
	var classs="master";
        if (regex.test(id)){
		classs=id.replace(regex,'$1');
	}
	// If the tool has a Pull Request of the user add the class 'OWN_PR' to color it differently
	if (tools_metadata[id]){
		if (tools_metadata[id]["pr_user"] == login) classs="OWN_PR ";
	}
	$tab.append("<li id="+id+" class="+classs+">"+value+"</li>");
	add_tab_event();
}

// /////////////////
// SELECT_TAB
//
// TODO: Finish the doc
function visual_select_tab(id){
	var $tab = $('#'+id);
	var $tab_active = $('li.active');
	$tab_active.removeClass('active');
	$tab.toggleClass('active');
        add_tab_event();
	var $title = $('p#title');
        var regex = new RegExp("^([a-zA-Z0-9]*)_[a-zA-Z0-9_-]*$");
	var status = id.replace(regex, '$1');
	var status_converter={"PR":"[Existing Pull Request","NEW":"[New Pull Request]","edit":"[Edit mode"};
	var status_long=status_converter[status];

        var $github_link = $('a#github_link');
	$github_link.hide();
	if (!status_long) {
		status_long="[Master";
	}
	else if (status == "new") {
		$github_link.attr("href", "https://github.com/ValentinMarcon/TESTAPI/tree/"+id);
		$github_link.show();
	}
	if (tools_metadata[id]){
		var pr_user=tools_metadata[id]['pr_user'];
		var pr_link=tools_metadata[id]['pr_link'];
		if (pr_user)  status_long=status_long+" by '"+pr_user+"']";
		if (pr_link) {
			$github_link.attr("href", pr_link);
			$github_link.show();
		}

	}
	else status_long=status_long+"]";
	$title.text($title.text() + " " + status_long);
}

// /////////////////
// REMOVE_TAB
//
// TODO: Finish the doc
function remove_tab(){
	var $tab_active = $('li.active');
    	$tab_active.remove();
	/*var entry=get_stored_entry(); // TODO Ensure i can remove that part
	print_tool(entry);
	visual_select_tab(entry['biotoolsID']);*/
}

// /////////////////
// CREATE_TABS
//
// TODO:
function create_tabs(tool){
	add_tab(tool);
        // TODO Change this visual selct by a change_tab (and remove the print tool from the functions that calls create_tabs)
        visual_select_tab(tool)
}



// /////////////////
// TAB_SELECTED
//
//TODO doc
//TODO MERGE functions with btnsendhide btncancelhide and printmode and changefalse (see exit_modif)
//
function change_tab(id_tab_selected){
	console.log(id_tab_selected+" : selected");
        if ((get_stored_entry("mode")=="edit") && (get_stored_entry("changes"))){
		var quit=confirm("If you change tab all modifications will be lost.\n  -Press OK to leave edit mode\n  -Press \"Cancel\" to return to edit mode");
		if (quit) {
			remove_tab();
			store_entry("print","mode");
			store_entry(false,"changes");
			var $btn_send = $('.btn_send');
		        var $btn_cancel = $('.btn_cancel');
			$btn_send.hide();
		        $btn_cancel.hide();
		}
		else {
			return;
		}
	}
	else if ((get_stored_entry("mode")=="edit") && (!id_tab_selected.includes('edit'))) {
		remove_tab();
		store_entry("print","mode");
	}
	var $tab_selected = $('#'+id_tab_selected);
     	var entry=get_stored_entry(id_tab_selected);
 	if (entry != false){
		print_tool(entry);
	}
	else {
		entry=get_stored_entry("new_entry");
     	        store_entry(entry,id_tab_selected);
		print_tool(entry);
	}
	visual_select_tab(id_tab_selected);
}

// ////////////////////////////////////////////////////
// WIP WIP WIP WIP WIP WIP WIP WIP WIP WIP WIP WIP WIP 


// ///////////////// 
// 
// 
//
// TODO : Finish the doc 

/*
function get_stored_modif(){
	var stored=sessionStorage.getItem("biotools_modif");
	if (stored) return(JSON.parse(stored));
	else alert ("No biotools_modif stored"); // retourner code erreur
}

function store_modif(modif_entry){
	    sessionStorage.setItem('biotools_modif',JSON.stringify(modif_entry));
}
*/

// WIP WIP WIP WIP WIP WIP WIP WIP WIP WIP WIP WIP WIP
// ////////////////////////////////////////////////////
