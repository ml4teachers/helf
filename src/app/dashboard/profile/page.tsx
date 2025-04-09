'use client'
// src/app/dashboard/profile/page.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ModelSelector } from '@/components/profile/ModelSelector'
import { MemoryManager } from '@/components/profile/MemoryManager'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/components/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NameEditor } from '@/components/profile/NameEditor'
import { AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabaseClient'
import { Capacitor } from '@capacitor/core'

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  
  // Function to delete user account and all related data
  const handleDeleteAccount = async () => {
    if (!user) return
    
    // Check if confirmation text matches
    if (deleteConfirmation.toLowerCase() !== 'delete my account') {
      setDeleteError('Please type "delete my account" to confirm')
      return
    }
    
    try {
      setIsDeleting(true)
      setDeleteError('')
      
      // Call the server-side API to delete the user account
      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete account');
      }
      
      // Sign out the user after successful deletion
      if (signOut) {
        await signOut()
      }
      
      // Redirect to login page
      if (!Capacitor.isNativePlatform()) {
        router.push('/auth/login')
      } else {
        // Handle native redirect/state change after account deletion if needed
        console.log('Account deleted on native platform. Skipping web redirect.')
      }
      
    } catch (error) {
      console.error('Error deleting account:', error)
      setDeleteError('Failed to delete account. Please try again later.')
    } finally {
      setIsDeleting(false)
    }
  }
  
  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4 md:p-6">
          <h1 className="text-3xl font-bold tracking-tight">Profile & Settings</h1>

          {/* Account Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Email Address</Label>
                <p className="text-sm text-muted-foreground pt-2">
                  {user?.email || 'Loading...'}
                </p>
              </div>
              <NameEditor /> {/* Use the NameEditor component */}
            </CardContent>
          </Card>

          {/* Assistant Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle>AI Assistant Settings</CardTitle>
              <CardDescription>
                Customize how the HELF assistant interacts with you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ModelSelector />
              <MemoryManager />
            </CardContent>
          </Card>

          {/* Account Actions Card */}
          <Card>
             <CardHeader>
               <CardTitle>Account Actions</CardTitle>
               <CardDescription>
                 Manage your account access and data
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
              <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
                {signOut && ( // Conditionally render logout if signOut function is available
                  <Button onClick={signOut} variant="secondary">
                    Log Out
                  </Button>
                )}
                
                <Button 
                  onClick={() => setShowDeleteDialog(true)} 
                  variant="destructive"
                >
                  Delete Account
                </Button>
              </div>
              
              <div className="text-sm text-muted-foreground mt-4">
                <p>Deleting your account will permanently remove all your data, including training plans, 
                session history, and personal preferences. This action cannot be undone.</p>
              </div>
             </CardContent>
          </Card>
          
          {/* Delete Account Dialog */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Delete Your Account
                </DialogTitle>
                <DialogDescription>
                  This action will permanently delete your account and all associated data.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="deleteConfirmation" className="text-sm font-medium">
                    This will permanently delete:
                  </Label>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Your user account and profile information</li>
                    <li>All your training plans</li>
                    <li>All your training sessions, exercise data and history</li>
                    <li>All your assistant preferences and settings</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="deleteConfirmation" className="text-sm font-medium">
                    To confirm, type "delete my account" below:
                  </Label>
                  <Input
                    id="deleteConfirmation"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="delete my account"
                    disabled={isDeleting}
                  />
                  {deleteError && (
                    <p className="text-sm text-destructive">{deleteError}</p>
                  )}
                </div>
                
                <p className="text-sm text-destructive font-medium">
                  This action cannot be undone. All of your data will be permanently deleted.
                </p>
              </div>
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setDeleteConfirmation('');
                    setDeleteError('');
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || deleteConfirmation.toLowerCase() !== 'delete my account'}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Account'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
  );
}