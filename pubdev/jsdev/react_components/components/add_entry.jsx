'use strict';
let React       = require( 'react' );
let TinyMCE     = require( 'react-tinymce' );
let Button      = require( 'react-bootstrap/lib/Button.js' );
let Prompt      = require( 'react-router-dom' ).Prompt;
let Link        = require( 'react-router-dom' ).Link;

let AddEntryModal = React.createClass( {
    getInitialState: function(){
        let key = new Date();
        key = key.getTime();
        let tinyID = 'tiny_' + key;
        let content;
        let asyncContentLoaded;
        switch( this.props.entryAction ) {
        case 'Add':
            content = '';
            asyncContentLoaded = true;
            break;
        case 'Reply':
            content = '';
            asyncContentLoaded = true;
            break;
        case 'Copy To Entry':
            content = this.props.content; 
            asyncContentLoaded = true;
            break;
        case 'Edit':
            content = '',
            asyncContentLoaded = false;
            break;
        default:
            content = '';
            asyncContentLoaded = true;
            break;
        }
        
        return {
            tinyID: tinyID, key: key, content: content, asyncContentLoaded: asyncContentLoaded, leaveCatch: true, whoami: undefined, recentlyUpdated: 0,
        };
    },

    componentDidMount: function(){
        
        let whoami = getSessionStorage( 'whoami' );
        if ( whoami ) {
            this.setState( {whoami:whoami} );
        }

        if ( this.props.entryAction == 'Edit' ) {
            $.ajax( {
                type: 'GET',
                url:  '/scot/api/v2/entry/'+ this.props.id,
                success: function( response ){
                    this.setState( {content: response.body, asyncContentLoaded: true, recentlyUpdated: response.updated} );
                    this.forceUpdate();
                }.bind( this ),
                error: function( data ) {
                    this.props.errorToggle( 'Error getting original data from source. Copy/Paste original', data );
                    this.setState( {content: 'Error getting original data from source. Copy/Paste original', asyncContentLoaded:true} );
                    this.forceUpdate();
                }.bind( this )
            } ); 
        }
        if ( $( '#not_saved_entry_'+this.state.key ).position() ) {
            $( '.entry-wrapper' ).scrollTop( $( '.entry-wrapper' ).scrollTop() + $( '#not_saved_entry_'+this.state.key ).position().top );
        }
    },

    shouldComponentUpdate: function() {
        return false; //prevent updating this component because it causes the page container to scroll upwards and lose focus due to a bug in paste_preprocess. If this is removed it will cause abnormal scrolling. 
    },

    render: function() {
        let not_saved_entry_id = 'not_saved_entry_'+this.state.key;
        return (
            <div id={not_saved_entry_id} className={'not_saved_entry'}>
                <div className={'row-fluid entry-outer'} style={{border: '3px solid blue',marginLeft: 'auto', marginRight: 'auto', width:'99.3%'}}>
                    <div className={'row-fluid entry-header'}>
                        <div className="entry-header-inner">[<Link style={{color:'black'}} to={'not_saved_0'}>Not_Saved_0</Link>]by {this.state.whoami}
                            <span className='pull-right' style={{display:'inline-flex',paddingRight:'3px'}}>
                                <Button bsSize={'xsmall'} onClick={this.submit} bsStyle={'success'}>Submit</Button>
                                <Button bsSize={'xsmall'} onClick={this.onCancel}>Cancel</Button>
                            </span>
                        </div>
                    </div>
                    {this.state.asyncContentLoaded ? 
                        <TinyMCE 
                            id={this.state.tinyID} 
                            content={this.state.content} 
                            className={'inputtext'} 
                            config={
                                {
                                    auto_focus:this.state.tinyID, 
                                    selector: 'textarea', 
                                    plugins: 'advlist lists link image charmap print preview hr anchor pagebreak searchreplace wordcount visualblocks visualchars code fullscreen insertdatetime media nonbreaking save table directionality emoticons template paste textcolor colorpicker textpattern imagetools', 
                                    table_clone_elements: 'strong em b i font h1 h2 h3 h4 h5 h6 p div', 
                                    paste_retain_style_properties: 'all', 
                                    paste_data_images:true, 
                                    paste_preprocess: function( plugin, args ) { function replaceA( string ) { return string.replace( /<(\/)?a([^>]*)>/g, '<$1span$2>' ); } args.content = replaceA( args.content ) + ' '; },
                                    relative_urls: false, 
                                    remove_script_host:false, 
                                    link_assume_external_targets:true, 
                                    toolbar1: 'full screen spellchecker | undo redo | bold italic | alignleft aligncenter alignright | bullist numlist | forecolor backcolor fontsizeselect fontselect formatselect | blockquote code link image insertdatetime | customBlockquote', 
                                    theme:'modern', 
                                    content_css:'/css/entryeditor.css', 
                                    height:250,
                                    verify_html: false,
                                    setup: function( editor ) {
                                            
                                        function blockquote() {
                                            return '<blockquote><p><br></p></blockquote>';
                                        }
                                            
                                        function insertBlockquote() {
                                            let html = blockquote();
                                            editor.insertContent( html );
                                        }

                                        editor.addButton( 'customBlockquote', {
                                            text: '500px max-height blockquote',
                                            //image: 'http://p.yusukekamiyamane.com/icons/search/fugue/icons/calendar-blue.png',
                                            tooltip: 'Insert a 500px max-height div (blockquote)',
                                            onclick: insertBlockquote
                                        } );
                                    }
                                }
                            } /> :
                        <div>Loading Editor...</div> 
                    }
                </div> 
                <Prompt when={this.state.leaveCatch} message="Unsubmitted entry detected. You may want to submit or copy the contents of the entry before navigating elsewhere. Click CANCEL to prevent navigation elsewhere." />
            </div>
        );
    },

    onCancel: function(){
        this.setState( { leaveCatch: false } );
        this.props.addedentry();
        this.setState( {change:false} );
    },
	
    submit: function(){
        if( $( '#tiny_' + this.state.key + '_ifr' ).contents().find( '#tinymce' ).text() == '' && $( '#' + this.state.key + '_ifr' ).contents().find( '#tinymce' ).find( 'img' ).length == 0 ) {
            alert( 'Please Add Some Text' );
        }
        else {    
            if( this.props.entryAction == 'Reply' ) {
                var data = new Object();
                $( '#tiny_' + this.state.key + '_ifr' ).contents().find( '#tinymce' ).each( function( x,y ){
                    $( y ).find( 'img' ).each( function( key, value ){
                        if ( $( value )[0].src.startsWith( 'blob' ) ) { //Checking to see if it's a locally copied file
                            let canvas = document.createElement( 'canvas' );
                            let set = new Image();
                            set = $( value );
                            canvas.width =  set[0].width;
                            canvas.height = set[0].height;
                            let ctx = canvas.getContext( '2d' );
                            ctx.drawImage( set[0], 0, 0 );
                            let dataURL = canvas.toDataURL( 'image/png' );
                            $( value ).attr( 'src', dataURL );
                        }
                    } );
                } );    
                data = JSON.stringify( {parent: Number( this.props.id ), body: $( '#tiny_' + this.state.key + '_ifr' ).contents().find( '#tinymce' ).html(), target_id:Number( this.props.targetid ) , target_type: this.props.type} );
                $.ajax( {
                    type: 'post',
                    url: '/scot/api/v2/entry',
                    data: data,
                    contentType: 'application/json; charset=UTF-8',
                    dataType: 'json',
                    success: function( response ){
                        this.setState( { leaveCatch: false } );
                        this.props.addedentry(); 
                    }.bind( this ),
                    error: function( response ) {
                        this.props.errorToggle( 'Failed to add entry.', response );
                    }.bind( this ) 
                } );   
                            
            }
            else if ( this.props.entryAction == 'Edit' ){
                $.ajax( {
                    type: 'GET',
                    url: '/scot/api/v2/entry/'+this.props.id,
                    success: function( response ){
                        if( this.state.recentlyUpdated != response.updated ){
                            this.forEdit( false );
                            let set = false;
                            let Confirm = {
                                launch: function( set ){
                                    this.forEdit( set );
                                }.bind( this )
                            };
                            $.confirm( {
                                icon: 'glyphicon glyphicon-warning',
                                confirmButtonClass: 'btn-info',
                                cancelButtonClass: 'btn-info',
                                confirmButton: 'Yes, override change',
                                cancelButton: 'No, Keep edited version from another user',
                                content: 'edit:' +'\n\n'+response.body,
                                backgroundDismiss: false,
                                title: 'Edit Conflict from another user' + '\n\n',
                                confirm: function(){
                                    Confirm.launch( true );
                                },
                                cancel: function(){
                                    return; 
                                }
                            } );
                        } else {
                            this.forEdit( true );
                        }
                    }.bind( this ),
                    error: function( data ) {
                        this.props.errorToggle( 'failed to get data for edit', data );
                    }.bind( this )
                } );
            }
            else if( this.props.type == 'alert' ){ 
                var data;
                $( '#tiny_' + this.state.key + '_ifr' ).contents().find( '#tinymce' ).each( function( x,y ){
                    $( y ).find( 'img' ).each( function( key, value ){
                        if ( $( value )[0].src.startsWith( 'blob' ) ) {   //Checking if it's a locally copied file
                            let canvas = document.createElement( 'canvas' );
                            let set = new Image();
                            set = $( value );
                            canvas.width =  set[0].width;
                            canvas.height = set[0].height;
                            let ctx = canvas.getContext( '2d' );
                            ctx.drawImage( set[0], 0, 0 );
                            let dataURL = canvas.toDataURL( 'image/png' );
                            $( value ).attr( 'src', dataURL );
                        }
                    } );
                } );
                data = JSON.stringify( {body: $( '#tiny_' + this.state.key + '_ifr' ).contents().find( '#tinymce' ).html(), target_id: Number( this.props.targetid ), target_type: 'alert',  parent: 0} );
                $.ajax( {
                    type: 'post', 
                    url: '/scot/api/v2/entry',
                    data: data,
                    contentType: 'application/json; charset=UTF-8',
                    dataType: 'json',
                    success: function( response ){
                        this.setState( { leaveCatch: false } );
                        this.props.addedentry();
                    }.bind( this ),
                    error: function( response ) {
                        this.props.errorToggle( 'Failed to add entry.', response );
                    }.bind( this ) 
                } );
            }	
            else {
                var data = new Object();
                $( '#tiny_' + this.state.key + '_ifr' ).contents().find( '#tinymce' ).each( function( x,y ){
                    $( y ).find( 'img' ).each( function( key, value ){
                        if ( $( value )[0].src.startsWith( 'blob' ) ) {   //Checking if its a locally copied file 
                            let canvas = document.createElement( 'canvas' );
                            let set = new Image();
                            set = $( value );
                            canvas.width =  set[0].width;
                            canvas.height = set[0].height;
                            let ctx = canvas.getContext( '2d' );
                            ctx.drawImage( set[0], 0, 0 );
                            let dataURL = canvas.toDataURL( 'image/png' );
                            $( value ).attr( 'src', dataURL ); 
                        }
                    } ); 
                } ); 
                data = {parent: 0, body: $( '#tiny_' + this.state.key + '_ifr' ).contents().find( '#tinymce' ).html(), target_id: Number( this.props.targetid ) , target_type: this.props.type};
                $.ajax( {
                    type: 'post',
                    url: '/scot/api/v2/entry',
                    data: JSON.stringify( data ),
                    contentType: 'application/json; charset=UTF-8',
                    dataType: 'json',
                    success: function( response ){
                        this.setState( { leaveCatch: false } );
                        this.props.addedentry();
                    }.bind( this ),
                    error: function( response ) {
                        this.props.errorToggle( 'Failed to add entry.', response );
                    }.bind( this )
                } );
            }
        }
    },
    forEdit: function( set ){
        if( set ){
            $( '#tiny_' + this.state.key + '_ifr' ).contents().find( '#tinymce' ).each( function( x,y ){
                $( y ).find( 'img' ).each( function( key, value ){
                    if ( $( value )[0].src.startsWith( 'blob' ) ) {   //Checking if its a lcoally copied file
                        let canvas = document.createElement( 'canvas' );
                        let set = new Image();
                        set = $( value );
                        canvas.width =  set[0].width;
                        canvas.height = set[0].height;
                        let ctx = canvas.getContext( '2d' );
                        ctx.drawImage( set[0], 0, 0 );
                        let dataURL = canvas.toDataURL( 'image/png' );
                        $( value ).attr( 'src', dataURL );
                    }
                } );
            } );
            let data = {
                parent: Number( this.props.parent ), 
                body: $( '#tiny_' + this.state.key + '_ifr' ).contents().find( '#tinymce' ).html(), 
                target_id: Number( this.props.targetid ) , 
                target_type: this.props.type,
                parsed: 0,
            };
            $.ajax( {
                type: 'put',
                url: '/scot/api/v2/entry/'+this.props.id,
                data: JSON.stringify( data ),
                contentType: 'application/json; charset=UTF-8',
                dataType: 'json',
                success: function( response ){
                    this.setState( { leaveCatch: false } );
                    this.props.addedentry();        
                }.bind( this ),
                error: function( response ) {
                    this.props.errorToggle( 'Failed to edit entry.', response );
                }.bind( this )
            } );
        }
    }
} );

module.exports = AddEntryModal;

