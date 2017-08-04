import React, { PureComponent, Component } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import ReactTable from 'react-table';

class Marker extends Component {
    constructor( props ) { 
        super( props );

        this.state = {
            isMarked: false,
        }
        
        this.removeMarkedItemsHandler = this.removeMarkedItemsHandler.bind(this);
        this.getMarkedItemsHandler = this.getMarkedItemsHandler.bind(this);
        this.setMarkedItemsHandler = this.setMarkedItemsHandler.bind(this);

    }

    componentWillMount() {
        this.mounted = true;
        
        let currentMarked = this.getMarkedItemsHandler();

        if ( currentMarked ) {
            for (let key of currentMarked ) {
                if ( key.id === this.props.id && key.type === this.props.type ) {
                    this.setState({ isMarked: true });
                }
            }
        }

    }
    
    componentWillUnmount() {
        this.mounted = false;
    }
    
    render() {
        return (
            <Button bsSize='xsmall' onClick={ this.state.isMarked ? this.removeMarkedItemsHandler : this.setMarkedItemsHandler }>
                <i style={{color: `${ this.state.isMarked ? 'green' : '' } `}} className={`fa fa${this.state.isMarked ? '-check' : '' }-square-o`} aria-hidden="true"></i>
                { this.state.isMarked ? <span>Marked</span> : <span>Mark</span> }
            </Button>
        )
    }
    
    getMarkedItemsHandler() {
        let markedItems = getMarkedItems();
        return ( markedItems );
    }

    removeMarkedItemsHandler( type, id ) {
        removeMarkedItems( this.props.type, this.props.id );
        this.setState( { isMarked: false } );
    }

   setMarkedItemsHandler() {
        setMarkedItems( this.props.type, this.props.id, this.props.string )
        this.setState({ isMarked: true});
    } 
    
}

export const removeMarkedItems = ( type, id ) => {
    let currentMarked = getMarkedItems();

    if ( currentMarked ) {
        for ( let i= 0; i < currentMarked.length ; i++ ) {
            if ( currentMarked[i].type == type && currentMarked[i].id == id ) {
                currentMarked.splice(i, 1);
                break;
            }
        }

        setLocalStorage( 'marked' , JSON.stringify( currentMarked ) );
    }
}

export const getMarkedItems = () => {
    let markedItems = getLocalStorage( 'marked' );
    if ( markedItems ) {
        markedItems = JSON.parse( markedItems );
        return (markedItems) ;
    }
}

export const setMarkedItems = ( type, id, string ) => {
    let nextMarked = []; 
    let currentMarked = getMarkedItems();

    if ( currentMarked.markedItems ) {
        for ( let key of currentMarked.markedItems ) {
            if ( key.type != type || key.id != id ) {
                nextMarked.push( key );
            }
        }
    }
    
    nextMarked.push( { id: id, type: type, subject: string.substring(0,120) } );
    setLocalStorage( 'marked' , JSON.stringify( nextMarked ));
}

Marker.propTypes = {
    isMarked: PropTypes.bool
}

Marker.defaultProps = {
    isMarked: false
}

export default Marker;
