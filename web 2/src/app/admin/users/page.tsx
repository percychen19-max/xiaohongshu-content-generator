"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";

interface User {
  id: string;
  phone: string;
  freeUsage: number;
  tokenBalance: number;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]); // 保存所有用户数据
  const [isLoading, setIsLoading] = useState(false);
  const [searchPhone, setSearchPhone] = useState(""); // 搜索关键词
  
  // 充值弹窗状态
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState("10");

  // 新增成员弹窗状态
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newFreeUsage, setNewFreeUsage] = useState("10");
  const [newTokenBalance, setNewTokenBalance] = useState("0");

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (Array.isArray(data)) {
        setAllUsers(data); // 保存所有用户
        filterUsers(data, searchPhone); // 应用当前筛选
      }
    } catch (err) {
      console.error(err);
      alert("加载用户列表失败");
    } finally {
      setIsLoading(false);
    }
  };

  // 按手机号筛选用户
  const filterUsers = (userList: User[], keyword: string) => {
    if (!keyword.trim()) {
      setUsers(userList); // 没有关键词时显示所有用户
      return;
    }
    const filtered = userList.filter((user) =>
      user.phone.includes(keyword.trim())
    );
    setUsers(filtered);
  };

  // 搜索框变化时实时筛选
  const handleSearchChange = (value: string) => {
    setSearchPhone(value);
    filterUsers(allUsers, value);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRecharge = async () => {
    if (!selectedUser) return;
    
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: selectedUser.id, 
          amount: parseInt(rechargeAmount) 
        }),
      });
      
      if (res.ok) {
        alert("充值成功！");
        setSelectedUser(null);
        loadUsers(); // 刷新列表
      } else {
        alert("操作失败");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateUser = async () => {
    const phone = newPhone.trim();
    if (!phone || phone.length !== 11) return alert("请输入有效的 11 位手机号");
    const freeUsage = parseInt(newFreeUsage || "3", 10);
    const tokenBalance = parseInt(newTokenBalance || "0", 10);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, freeUsage, tokenBalance }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "新增失败");
        return;
      }
      alert("新增成员成功！");
      setShowCreateDialog(false);
      setNewPhone("");
      setNewFreeUsage("10");
      setNewTokenBalance("0");
      loadUsers();
    } catch (e) {
      console.error(e);
      alert("网络错误，新增失败");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">用户管理</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />
            新增成员
          </Button>
          <Button onClick={loadUsers} disabled={isLoading}>
            {isLoading ? "刷新中..." : "刷新列表"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>所有用户</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="搜索手机号..." 
                className="pl-8" 
                value={searchPhone}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-4 font-medium">手机号</th>
                  <th className="p-4 font-medium">注册时间</th>
                  <th className="p-4 font-medium">剩余额度</th>
                  <th className="p-4 font-medium">Token余额</th>
                  <th className="p-4 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      暂无用户数据
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-t hover:bg-muted/30">
                      <td className="p-4 font-medium">{user.phone}</td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.freeUsage > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                          {user.freeUsage} 次
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          (user.tokenBalance || 0) > 0 ? "bg-blue-100 text-blue-800" : "bg-muted text-muted-foreground"
                        }`}>
                          {user.tokenBalance || 0}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedUser(user)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          充值
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 新增成员弹窗 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增成员</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">手机号</label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="请输入 11 位手机号" />
              <p className="text-xs text-muted-foreground">成员将使用手机号 + 1234 验证码登录。</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">初始体验次数</label>
                <Input type="number" value={newFreeUsage} onChange={(e) => setNewFreeUsage(e.target.value)} placeholder="默认3次" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">初始 Token 余额</label>
                <Input type="number" value={newTokenBalance} onChange={(e) => setNewTokenBalance(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
            <Button onClick={handleCreateUser}>确认新增</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 充值弹窗 */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>手动充值</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">用户手机</label>
              <Input value={selectedUser?.phone} disabled />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">增加额度 (次)</label>
              <Input 
                type="number" 
                value={rechargeAmount} 
                onChange={(e) => setRechargeAmount(e.target.value)} 
              />
              <p className="text-xs text-muted-foreground">可以是负数（扣除额度）</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>取消</Button>
            <Button onClick={handleRecharge}>确认充值</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

