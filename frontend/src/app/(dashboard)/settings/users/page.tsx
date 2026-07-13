'use client';

import * as React from 'react';
import { Users, Plus, Edit2, Trash2, Shield, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { fetchUsers, createUser, updateUser, deleteUser } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';

interface User {
  id: string;
  username: string;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editingUserId, setEditingUserId] = React.useState<string | null>(null);

  const defaultForm = { username: '', password: '', role: 'operator' };
  const [formData, setFormData] = React.useState(defaultForm);
  const [formError, setFormError] = React.useState('');

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const openAdd = () => {
    setFormData(defaultForm);
    setFormError('');
    setIsAddOpen(true);
  };

  const openEdit = (user: User) => {
    setFormData({ username: user.username, role: user.role, password: '' });
    setEditingUserId(user.id);
    setFormError('');
    setIsEditOpen(true);
  };

  const handleSave = async () => {
    setFormError('');
    if (!formData.username) {
      setFormError('Username is required.');
      return;
    }
    if (!editingUserId && !formData.password) {
      setFormError('Password is required for new users.');
      return;
    }

    try {
      if (editingUserId) {
        await updateUser(editingUserId, formData);
        setIsEditOpen(false);
      } else {
        await createUser(formData);
        setIsAddOpen(false);
      }
      loadData();
    } catch (err) {
      setFormError((err as Error).message || 'Failed to save user.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id);
      loadData();
    } catch (err) {
      alert((err as Error).message || 'Failed to delete user');
    }
  };

  const userFormFields = (
    <div className="grid gap-4 py-4">
      {formError && (
        <div className="text-sm text-destructive font-semibold bg-destructive/10 p-2 rounded">
          {formError}
        </div>
      )}
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="username" className="text-right">Username</Label>
        <Input
          id="username"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="password" className="text-right">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder={editingUserId ? "Leave blank to keep unchanged" : ""}
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="role" className="text-right">Role</Label>
        <Select
          value={formData.role}
          onValueChange={(val) => setFormData({ ...formData, role: val || 'operator' })}
        >
          <SelectTrigger className="col-span-3">
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="operator">Operator</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-6 min-h-0 max-w-5xl mx-auto w-full p-2 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage NVR login access, operator permissions, and administrator accounts.
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={
            <Button onClick={openAdd} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Add User</Button>
          } />
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new login for accessing the NVR.
              </DialogDescription>
            </DialogHeader>
            {userFormFields}
            <DialogFooter>
              <Button type="button" onClick={handleSave}>Create Account</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="flex flex-col flex-1 overflow-hidden min-h-0 shadow">
        <CardHeader className="shrink-0 bg-muted/40 border-b">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Registered Users
          </CardTitle>
          <CardDescription>
            Active user accounts mapped in the local database.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden min-h-0">
          <ScrollArea className="h-full">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Added Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        Loading users...
                      </TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-semibold flex items-center gap-2">
                          <div className="h-8 w-8 bg-muted rounded-full flex items-center justify-center">
                            <UserIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          {user.username}
                        </TableCell>
                        <TableCell>
                          {user.role === 'admin' ? (
                            <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20">
                              <Shield className="h-3 w-3 mr-1" /> Admin
                            </Badge>
                          ) : (
                            <Badge variant="outline">Operator</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(user.createdAt), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" title="Edit User" onClick={() => openEdit(user)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              } />
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User Account?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the user <b>{user.username}</b>? They will no longer be able to log into the NVR.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(user.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards Grid */}
            <div className="md:hidden p-4 space-y-3">
              {loading ? (
                <div className="text-center py-6 text-muted-foreground text-sm">Loading users...</div>
              ) : users.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">No users found.</div>
              ) : (
                users.map((user) => (
                  <Card key={user.id} className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
                          <UserIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg leading-none">{user.username}</div>
                          <div className="text-xs text-muted-foreground mt-1">Joined {format(new Date(user.createdAt), 'MMM yyyy')}</div>
                        </div>
                      </div>
                      <div>
                        {user.role === 'admin' ? (
                          <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20">
                            <Shield className="h-3 w-3 mr-1" /> Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline">Operator</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-2 border-t">
                      <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                        <Edit2 className="h-4 w-4 mr-1.5" /> Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger render={
                          <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                          </Button>
                        } />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {user.username}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this user? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(user.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update the role or set a new password.
              </DialogDescription>
            </DialogHeader>
            {userFormFields}
            <DialogFooter>
              <Button type="button" onClick={handleSave}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}