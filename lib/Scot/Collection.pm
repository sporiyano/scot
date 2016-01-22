package Scot::Collection;

use v5.18;
use lib '../../lib';
use strict;
use warnings;

use Moose 2;
use Data::Dumper;
use Type::Params qw/compile/;
use Try::Tiny;
use Types::Standard qw/slurpy :types/;
use Meerkat::Cursor;
use Carp qw/croak/;
use Scot::Env;

extends 'Meerkat::Collection';

has env => (
    is      => 'ro',
    isa     => 'Scot::Env',
    required    => 1,
    default     => sub { Scot::Env->instance; },
);

=item B<create(%args)>

replacing Meerkat's create with one that will generate a integer id.

=cut

override 'create' => sub {
    state $check        = compile( Object, slurpy ArrayRef );
    my ($self, $args)   = $check->(@_);
    my $env = $self->env;
    my $log = $self->env->log;

#    $log->trace("In overriden create");

    my @args    = ( ref $args->[0] eq 'HASH' ? %{$args->[0]} : @$args );
    my $iid     = $self->get_next_id;

    push @args, "id" => $iid;

    if ( $self->class->meta->does_role("Scot::Role::Permittable") ) {
        $log->trace("Checking for group permissions !!!!!!!");
        $self->get_group_permissions(\@args);
    }

    my $obj = $self->class->new( @args, _collection => $self );
    $self->_save($obj);

    return $obj;
};

sub exact_create {
    state $check        = compile( Object, slurpy ArrayRef );
    my ($self, $args)   = $check->(@_);
    my $env = $self->env;
    my $log = $self->env->log;

#    $log->trace("In exact create");

    my @args    = ( ref $args->[0] eq 'HASH' ? %{$args->[0]} : @$args );
    if ( $self->class->meta->does_role("Scot::Role::Permittable") ) {
        $log->trace("Checking for group permissions !!!!!!!");
        $self->get_group_permissions(\@args);
    }

    my $obj;
    eval {
        $obj = $self->class->new( @args, _collection => $self );
        $self->_save($obj);
    };
    if ( $@ ) {
        $log->warn("\@ARGS are ", {filter=>\&Dumper, value =>\@args});
        $log->error("ERROR: $@");
    }

    return $obj;
}

override '_build_collection_name'    => sub {
    my ($self)  = @_;
    my $name    = lcfirst((split(/::/, $self->class))[-1]);
    # $self->env->log->debug("collection name will be: $name");
    return $name;
};

=item B<find_iid($id)>

meerkat's find_id works on mongo oid's
this function will use integer id's

=cut

sub find_iid {
    state $check    = compile(Object, Int);
    my ($self, $id) = $check->(@_);
    $id += 0;
    my $data    = $self->_try_mongo_op(
        find_iid => sub { $self->_mongo_collection->find_one({ id => $id }) }
    );
    return unless $data;
    return $self->thaw_object($data);
}

sub set_next_id {
    my $self    = shift;
    my $id      = shift;
    my $collection  = $self->collection_name;
    my %command;
    my $tie     = tie(%command, "Tie::IxHash");
    %command        = (
        findAndModify   => "nextid",
        query           => { for_collection => $collection },
        update          => { '$set' => { last_id => $id } },
        'new'           => 1,
        upsert          => 1,
    );
    my $mongo   = $self->meerkat;
    my $iid = $self->_try_mongo_op(
        get_next_id => sub {
            my $db_name = $mongo->database_name;
            my $db      = $mongo->_mongo_database($db_name);
            my $job     = $db->run_command(\%command);
            return $job->{value}->{last_id};
        }
    );
    return $iid;
}



=item B<get_next_id()>

users hate typing in oid's on the URL, so give them a friendly integer

=cut

sub get_next_id {
    my $self        = shift;
    my $collection  = $self->collection_name;
    my %command;
    my $tie         = tie(%command, "Tie::IxHash");
    %command        = (
        findAndModify   => "nextid",
        query           => { for_collection => $collection },
        update          => { '$inc' => { last_id => 1 } },
        'new'           => 1,
        upsert          => 1,
    );

    my $mongo   = $self->meerkat;

    my $id = $self->_try_mongo_op(
        get_next_id => sub {
            my $db_name = $mongo->database_name;
            my $db      = $mongo->_mongo_database($db_name);
            my $job     = $db->run_command(\%command);
            return $job->{value}->{last_id};
        }
    );
    return $id;
}

sub get_subthing {
    my $self        = shift;
    my $thing       = shift;
    my $id          = shift;
    my $subthing    = shift;

    my $env     = $self->env;
    my $mongo   = $env->mongo;
    my $log     = $env->log;

    my $linkcol;
    my $subcol  = $mongo->collection(ucfirst($subthing));
    my $cursor;

    $log->trace("get_subthing");
    # first see if there is a Link record
    # then try for an attribute match

    try {
        $linkcol  = $mongo->collection("Link");
    }
    catch {
        $log->error("Failed to get the Link Collection!");
        return undef;
    };

    unless ( $linkcol ) {
        $log->error("Collection Link error!");
        return undef;
    }
    my $find_href   = {
            target_type   => $thing,
            target_id     => $id + 0,
            item_type     => $subthing,
    };
    # $log->trace("lincol = ",{filter=>\&Dumper, value=>$linkcol});
    $log->trace("Looking for links matching ",
                {filter=>\&Dumper, value=>$find_href});
    $log->trace("DB is ". $mongo->database_name);
    try {
         $cursor = $linkcol->find($find_href);
         $log->debug("cursor count is ".$cursor->count);
    }
    catch {
        $log->error("Failed finding Link cursor!");
        $log->error("cursor = ",{filter=>\&Dumper, value => $cursor});

        $log->debug("trying for direct link");
    };

    if ( defined $cursor and ref($cursor) eq "Meerkat::Cursor" and
         $cursor->count > 0) {
        # now we have a cursor of Links, translate that into 
        # a cursor of the subthing
        # I wish I could figure out why meerkat is not returnin objects 
        # with ->all
        # my @ids = map { $_->{item_id} } $cursor->all;
        my @ids;
        while ( my $linkobj = $cursor->next ) {
            my $href    = $linkobj->as_hash;
            $log->debug("link = ", {filter=>\&Dumper, value=>$href});
            push @ids, $linkobj->item_id;
        }
        $log->debug("looking to match ids = ",{filter=>\&Dumper,value=>\@ids});
        my $subcursor = $subcol->find({ id  => { '$in' => \@ids } });
        return $subcursor;
    }
    else {
        # otherwise, assume the subthing has an 
        # attribute named the same as the $thing
        # and that it holds the matching ID
        $cursor = $subcol->find({$thing => $id + 0});
        return $cursor;
    }
        

}

sub get_targets {
    my $self    = shift;
    my %params  = @_;
    my $id      = $params{target_id};
    my $thing   = $params{target_type};
    my $search  = {
        'targets.type' => $thing,
        'targets.id'   => $id,
    };
    $self->env->log->debug("get targets: ",{ filter =>\&Dumper, value => $search});
    my $cursor  = $self->find($search);
    return $cursor;
}

sub get_group_permissions {
    my $self    = shift;
    my $aref    = shift;    # using ref allows us to modify array here 
    my $env     = $self->env;
    my $log     = $self->env->log;

    # check the araf for readgroups/modifygroups explicitly passed in from api and 
    # 
    my $rgflag = 0;
    my $mgflag = 0;
    foreach my $arg (@$aref) {
        $log->trace("arg is $arg");
        
        if ( $arg eq "readgroups" ) {
            $rgflag++;
        }
        if ( $arg eq "modifygroups" ) {
            $mgflag++;
        }
    }
    unless ($rgflag) {
        $log->trace("adding default readgroups");
        push @$aref, "readgroups" => $env->default_groups->{read};
    }
    unless ($mgflag) {
        $log->trace("adding default modifygroups");
        push @$aref, "modifygroups" => $env->default_groups->{modify};
    }

}

sub upsert_targetables {
    my $self    = shift;
    my $colname = shift;
    my $type    = shift;
    my $id      = shift;
    my @items   = @_;
    my $key     = "name";   # default field for Source

    if ( $colname eq "Tag" ) {
        $key    = "text";   
    }

    my $col = $self->meerkat->collection($colname);

    foreach my $item (@items) {
        my $object  = $col->find_one({$key => $item});
        if ($object) {
            $object->update_add( targets => {
                id   => $id,
                type => $type,
            });
        }
        else {
            $object = $col->create({
                $key    => $item,
                targets => [{
                    id   => $id,
                    type => $type,
                }],
            });
        }
    }
}

sub get_value_from_request {
    my $self    = shift;
    my $req     = shift;
    my $key     = shift;

    return  $req->{request}->{params}->{$key} //
            $req->{request}->{json}  ->{$key};
} 

1;
