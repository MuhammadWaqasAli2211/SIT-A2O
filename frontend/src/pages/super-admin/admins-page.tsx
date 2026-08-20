import { motion } from 'motion/react'
import { Mail, MoreHorizontal, ShieldCheck, ShieldPlus, TriangleAlert } from 'lucide-react'

import { PageHeader, StatCard } from '@/components/shared/portal-ui'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ADMINS } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

export default function SuperAdminAdminsPage() {
  const active = ADMINS.filter((a) => a.status === 'active').length
  const unassigned = ADMINS.filter((a) => a.bootcamps.length === 0).length

  return (
    <>
      <PageHeader
        title="Administrators"
        description="Provision bootcamp admins and control what each one can reach."
        actions={
          <Button>
            <ShieldPlus className="size-4" />
            Invite administrator
          </Button>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Admin accounts are provisioned, never self-service</AlertTitle>
          <AlertDescription>
            Signup can only ever create a candidate account. Elevated roles are granted
            here, deliberately, and each admin sees only the bootcamps assigned to them.
          </AlertDescription>
        </Alert>
      </motion.div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total administrators" value={ADMINS.length} icon={ShieldCheck} delay={0} />
        <StatCard label="Active" value={active} icon={ShieldCheck} hint="signed in recently" delay={0.06} />
        <StatCard label="Unassigned" value={unassigned} icon={TriangleAlert} hint="no bootcamp" delay={0.12} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.16 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All administrators</CardTitle>
            <CardDescription>Scope is enforced server-side, not just in the UI</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Administrator</TableHead>
                    <TableHead>Assigned bootcamps</TableHead>
                    <TableHead>Last active</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ADMINS.map((admin, index) => (
                    <motion.tr
                      key={admin.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.2 + index * 0.06 }}
                      className="border-b border-border transition-colors last:border-0 hover:bg-muted/50"
                    >
                      <TableCell>
                        <span className="flex items-center gap-3">
                          <span
                            className={cn(
                              'grid size-9 shrink-0 place-items-center rounded-lg text-xs font-semibold',
                              admin.status === 'active'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {admin.name.split(' ').map((n) => n[0]).join('')}
                          </span>
                          <span className="flex flex-col">
                            <span className="text-sm font-medium">{admin.name}</span>
                            <span className="text-xs text-muted-foreground">{admin.email}</span>
                          </span>
                        </span>
                      </TableCell>

                      <TableCell>
                        {admin.bootcamps.length === 0 ? (
                          <Badge variant="outline" className="gap-1 text-[0.7rem]">
                            <TriangleAlert className="size-3" />
                            None assigned
                          </Badge>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {admin.bootcamps.map((bootcamp) => (
                              <Badge key={bootcamp} variant="secondary" className="text-[0.7rem]">
                                {bootcamp}
                              </Badge>
                            ))}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                        {admin.lastActive}
                      </TableCell>

                      <TableCell>
                        <Badge
                          className={cn(
                            admin.status === 'active'
                              ? 'bg-success/15 text-success'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {admin.status}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost">
                            <Mail className="size-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <button
                                  type="button"
                                  aria-label={`Actions for ${admin.name}`}
                                  className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                />
                              }
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>Assign bootcamp</DropdownMenuItem>
                              <DropdownMenuItem>Edit permissions</DropdownMenuItem>
                              <DropdownMenuItem>View audit log</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive">
                                Deactivate account
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}
