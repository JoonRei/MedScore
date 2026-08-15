export const dynamic = "force-dynamic";
export const revalidate = 0;
import {StudentShell} from '@/components/StudentShell';import{requireStudent}from'@/lib/student-session';
export default async function Layout({children}:{children:React.ReactNode}){const{student}=await requireStudent();return <StudentShell codeName={student.code_name}>{children}</StudentShell>}
